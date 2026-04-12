import base64
import json
import os
from typing import Any

from openai import AsyncOpenAI


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
    if "score" in parsed:
        return parsed
    if "result" in parsed and isinstance(parsed["result"], dict):
        return parsed["result"]
    raise ValueError("Judge payload missing score field.")


async def auto_judge_variants(
    paths: list[str],
    guidelines: dict[str, Any],
    brand_kit: dict[str, Any],
) -> list[dict[str, Any]]:
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    scores: list[dict[str, Any]] = []

    system_prompt = """You are an expert Instagram ad designer.
Score each image from 1 to 10 on:
1. Guideline adherence (objective, angle, tone)
2. Visual hierarchy and CTA prominence
3. Brand consistency
Return strict JSON object with fields:
{
  "score": number,
  "strengths": string[],
  "weaknesses": string[],
  "critique": string
}"""

    for path in paths:
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
        data = _parse_score_payload(raw)
        data["score"] = float(data.get("score", 0))
        data.setdefault("strengths", [])
        data.setdefault("weaknesses", [])
        data.setdefault("critique", "")
        scores.append(data)

    return scores
