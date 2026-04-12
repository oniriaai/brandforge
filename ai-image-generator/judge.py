import asyncio
import base64
import json
import os
from pathlib import Path
from typing import Any

from openai_client import create_openai_client

ALLOWED_DEFECT_TAGS = {
    "low_contrast",
    "weak_hierarchy",
    "cta_not_prominent",
    "brand_mismatch",
    "text_overflow",
    "text_density_high",
    "logo_placement_issue",
    "visual_clutter",
    "supporting_visual_missing",
    "poor_alignment",
    "readability_issue",
    "other",
}

ALLOWED_SEVERITY = {"low", "medium", "high"}
SUBSCORE_KEYS = [
    "guideline_adherence",
    "visual_hierarchy",
    "cta_prominence",
    "brand_consistency",
    "readability",
]


def _to_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _as_string_list(value: Any, *, max_items: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        if isinstance(item, str):
            text = item.strip()
            if text:
                out.append(text)
        if len(out) >= max_items:
            break
    return out


def _pick_alias(source: dict[str, Any], aliases: list[str]) -> Any:
    for alias in aliases:
        if alias in source:
            return source[alias]
    return None


def _normalize_subscores(data: dict[str, Any], overall_score: float) -> dict[str, float]:
    raw = data.get("subscores", {})
    if not isinstance(raw, dict):
        raw = {}
    normalized = {
        "guideline_adherence": _clamp(
            _to_float(_pick_alias(raw, ["guideline_adherence", "guidelineAdherence", "guidelines"]), overall_score),
            0.0,
            10.0,
        ),
        "visual_hierarchy": _clamp(
            _to_float(_pick_alias(raw, ["visual_hierarchy", "visualHierarchy", "hierarchy"]), overall_score),
            0.0,
            10.0,
        ),
        "cta_prominence": _clamp(
            _to_float(_pick_alias(raw, ["cta_prominence", "ctaProminence", "cta"]), overall_score),
            0.0,
            10.0,
        ),
        "brand_consistency": _clamp(
            _to_float(_pick_alias(raw, ["brand_consistency", "brandConsistency", "brand"]), overall_score),
            0.0,
            10.0,
        ),
        "readability": _clamp(
            _to_float(_pick_alias(raw, ["readability", "legibility", "text_readability"]), overall_score),
            0.0,
            10.0,
        ),
    }
    return normalized


def _normalize_defects(data: dict[str, Any]) -> list[dict[str, str]]:
    raw = data.get("defects", [])
    defects: list[dict[str, str]] = []
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        raw = []

    for item in raw[:8]:
        if isinstance(item, str):
            tag = item.strip().lower().replace(" ", "_")
            if not tag:
                continue
            if tag not in ALLOWED_DEFECT_TAGS:
                tag = "other"
            defects.append({"tag": tag, "severity": "medium", "evidence": ""})
            continue
        if not isinstance(item, dict):
            continue
        tag = str(item.get("tag") or item.get("code") or item.get("type") or "other").strip().lower().replace(" ", "_")
        if tag not in ALLOWED_DEFECT_TAGS:
            tag = "other"
        severity = str(item.get("severity") or "medium").strip().lower()
        if severity not in ALLOWED_SEVERITY:
            severity = "medium"
        evidence = str(item.get("evidence") or item.get("description") or item.get("reason") or "").strip()
        defects.append({"tag": tag, "severity": severity, "evidence": evidence})
    return defects


def _normalize_confidence(data: dict[str, Any]) -> float:
    value = _to_float(data.get("confidence"), 0.65)
    if value > 1.0:
        value = value / 100.0
    return _clamp(value, 0.0, 1.0)


def _parse_score_payload(raw: str) -> dict[str, Any]:
    parsed = json.loads(raw)
    if isinstance(parsed, list):
        if not parsed:
            raise ValueError("Judge returned empty list payload.")
        first = parsed[0]
        if not isinstance(first, dict):
            raise ValueError("Judge list payload item is not an object.")
        return first
    if not isinstance(parsed, dict):
        raise ValueError("Judge response is not an object.")
    if "score" in parsed or "overall_score" in parsed or "overallScore" in parsed:
        return parsed
    if "result" in parsed and isinstance(parsed["result"], dict):
        return parsed["result"]
    raise ValueError("Judge payload missing score field.")


def _normalize_score_payload(raw_data: dict[str, Any]) -> dict[str, Any]:
    overall_raw = _pick_alias(raw_data, ["score", "overall_score", "overallScore", "overall"])
    overall_score = _clamp(_to_float(overall_raw, 0.0), 0.0, 10.0)
    if overall_score <= 0:
        derived = _normalize_subscores(raw_data, 7.0)
        overall_score = _clamp(sum(derived[key] for key in SUBSCORE_KEYS) / len(SUBSCORE_KEYS), 0.0, 10.0)
        subscores = derived
    else:
        subscores = _normalize_subscores(raw_data, overall_score)

    strengths = _as_string_list(raw_data.get("strengths"), max_items=8)
    weaknesses = _as_string_list(raw_data.get("weaknesses"), max_items=8)
    defects = _normalize_defects(raw_data)
    repair_hints = _as_string_list(
        _pick_alias(raw_data, ["repair_hints", "repairHints", "suggestions"]),
        max_items=8,
    )
    critique = str(raw_data.get("critique") or "").strip()
    confidence = _normalize_confidence(raw_data)

    if not repair_hints and weaknesses:
        repair_hints = [f"Fix: {item}" for item in weaknesses[:3]]

    return {
        "score": overall_score,
        "subscores": subscores,
        "defects": defects,
        "repair_hints": repair_hints,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "critique": critique,
        "confidence": confidence,
    }


async def auto_judge_variants(
    paths: list[str],
    guidelines: dict[str, Any],
    brand_kit: dict[str, Any],
) -> list[dict[str, Any]]:
    client = create_openai_client()
    model = os.getenv("OPENAI_MODEL_JUDGE") or os.getenv("OPENAI_MODEL") or "gpt-4o"
    judge_concurrency = max(1, int(os.getenv("JUDGE_CONCURRENCY", "3")))
    semaphore = asyncio.Semaphore(judge_concurrency)

    system_prompt = """You are an expert Instagram ad designer and conversion-focused visual critic.
Evaluate each image and return a strict JSON object with this schema:
{
  "score": number,                     // overall 0-10
  "subscores": {
    "guideline_adherence": number,     // 0-10
    "visual_hierarchy": number,        // 0-10
    "cta_prominence": number,          // 0-10
    "brand_consistency": number,       // 0-10
    "readability": number              // 0-10
  },
  "defects": [
    {
      "tag": string,                   // one of: low_contrast, weak_hierarchy, cta_not_prominent, brand_mismatch, text_overflow, text_density_high, logo_placement_issue, visual_clutter, supporting_visual_missing, poor_alignment, readability_issue, other
      "severity": string,              // low|medium|high
      "evidence": string
    }
  ],
  "repair_hints": string[],
  "strengths": string[],
  "weaknesses": string[],
  "critique": string,
  "confidence": number                 // 0-1
}
No markdown, no extra keys, no prose outside JSON."""

    async def score_variant(path: str) -> dict[str, Any]:
        async with semaphore:
            with open(path, "rb") as image_file:
                b64 = base64.b64encode(image_file.read()).decode("utf-8")

            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"Guidelines: {json.dumps(guidelines, ensure_ascii=False)}\nBrand: {json.dumps(brand_kit, ensure_ascii=False)}",
                            },
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                        ],
                    },
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw = response.choices[0].message.content or "{}"
            try:
                parsed = _parse_score_payload(raw)
            except (json.JSONDecodeError, ValueError) as exc:
                raise ValueError(f"Malformed judge response for {Path(path).name}: {exc}") from exc
            return _normalize_score_payload(parsed)

    return await asyncio.gather(*(score_variant(path) for path in paths))
