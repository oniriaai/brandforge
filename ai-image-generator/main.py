import json
import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, HttpUrl

from judge import auto_judge_variants
from renderer import render_and_validate


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def extract_keywords(text: str, limit: int = 6) -> list[str]:
    tokens = re.findall(r"[A-Za-zÀ-ÿ0-9]{4,}", text.lower())
    deduped: list[str] = []
    for token in tokens:
        if token not in deduped:
            deduped.append(token)
        if len(deduped) >= limit:
            break
    return deduped


def parse_guidelines(guidelines_text: str) -> dict[str, str]:
    matches = {
        "objective": re.search(r"(objective|objetivo)\s*:\s*([^\n\.]+)", guidelines_text, re.IGNORECASE),
        "angle": re.search(r"(angle|ángulo)\s*:\s*([^\n\.]+)", guidelines_text, re.IGNORECASE),
        "audience": re.search(r"(audience|audiencia)\s*:\s*([^\n\.]+)", guidelines_text, re.IGNORECASE),
        "tone": re.search(r"(tone|tono)\s*:\s*([^\n\.]+)", guidelines_text, re.IGNORECASE),
    }
    return {
        "objective": (matches["objective"].group(2).strip() if matches["objective"] else "conversion"),
        "angle": (matches["angle"].group(2).strip() if matches["angle"] else "social proof"),
        "audience": (matches["audience"].group(2).strip() if matches["audience"] else "professional audience"),
        "tone": (matches["tone"].group(2).strip() if matches["tone"] else "confident"),
        "hierarchy_notes": guidelines_text.strip() or "Prioritize clear hierarchy with a dominant CTA.",
    }


def infer_content(input_text: str, design_guidelines: str) -> dict[str, Any]:
    lines = [line.strip() for line in input_text.splitlines() if line.strip()]
    if not lines:
        lines = ["Compelling branded message", "Clear value proposition", "Take action now"]
    hook = lines[0][:120]
    headline = lines[1][:90] if len(lines) > 1 else hook[:90]
    body = " ".join(lines[2:])[:240] if len(lines) > 2 else lines[0][:220]
    cta_candidates = [line for line in lines if any(word in line.lower() for word in ("demo", "agenda", "descubre", "comienza", "start", "book", "try", "join"))]
    cta = cta_candidates[0][:56] if cta_candidates else "Get started today"
    lowered = design_guidelines.lower()
    if "bold" in lowered or "agresiv" in lowered:
        tone = "bold"
    elif "minimal" in lowered or "limpio" in lowered:
        tone = "minimal"
    elif "corporate" in lowered or "profesional" in lowered:
        tone = "professional"
    else:
        tone = "confident"
    return {
        "hook": hook,
        "headline": headline,
        "body": body,
        "cta": cta,
        "tone": tone,
        "visualIntent": design_guidelines[:180] or "High-conversion branded visual",
        "keywordSignals": extract_keywords(f"{input_text}\n{design_guidelines}"),
    }


def infer_platform_dimensions(platform: str) -> tuple[int, int]:
    if platform == "instagram_feed_4x5":
        return (1080, 1350)
    return (1080, 1080)


def format_from_platform(platform: str) -> str:
    width, height = infer_platform_dimensions(platform)
    return f"{width}x{height}"


def truncate_for_layout(text: str, max_chars: int) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= max_chars:
        return normalized
    candidate = normalized[: max_chars + 1]
    last_space = candidate.rfind(" ")
    if last_space >= int(max_chars * 0.6):
        candidate = candidate[:last_space]
    return candidate.rstrip(" ,.;:-")


def text_constraints_for_format(format_str: str) -> dict[str, int]:
    if format_str == "1080x1350":
        return {
            "hookMaxChars": 68,
            "headlineMaxChars": 86,
            "bodyMaxChars": 180,
            "ctaMaxChars": 30,
            "maxHeadlineLines": 3,
            "maxBodyLines": 4,
        }
    return {
        "hookMaxChars": 56,
        "headlineMaxChars": 72,
        "bodyMaxChars": 140,
        "ctaMaxChars": 26,
        "maxHeadlineLines": 2,
        "maxBodyLines": 3,
    }


def constrain_input_text_for_format(base_text: str, format_str: str) -> str:
    constraints = text_constraints_for_format(format_str)
    lines = [line.strip() for line in base_text.splitlines() if line.strip()]
    if not lines:
        lines = ["Compelling branded message", "Clear value proposition", "Get started today"]

    hook = truncate_for_layout(lines[0], constraints["hookMaxChars"])
    headline_seed = lines[1] if len(lines) > 1 else lines[0]
    headline = truncate_for_layout(headline_seed, constraints["headlineMaxChars"])

    body_seed = " ".join(lines[2:]) if len(lines) > 2 else " ".join(lines[1:]) or lines[0]
    body = truncate_for_layout(body_seed, constraints["bodyMaxChars"])

    action_words = ("demo", "agenda", "descubre", "comienza", "start", "book", "try", "join", "shop", "buy")
    cta_source = next((line for line in lines if any(word in line.lower() for word in action_words)), lines[-1])
    cta = truncate_for_layout(cta_source, constraints["ctaMaxChars"])

    return "\n\n".join([hook, headline, body, cta]).strip()


def build_public_asset_url(file_path: str) -> str:
    base_url = os.getenv("DELIVERY_BASE_URL", "http://localhost:4100").rstrip("/")
    return f"{base_url}/output/{Path(file_path).name}"


class JsonStateStore:
    def __init__(self, state_file: str):
        self.state_file = Path(state_file)
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.state_file.exists():
            self.state_file.write_text(json.dumps({"jobs": {}, "post_jobs": {}}), encoding="utf-8")
        self._state = self._load()

    def _load(self) -> dict[str, Any]:
        raw = self.state_file.read_text(encoding="utf-8")
        parsed = json.loads(raw) if raw.strip() else {}
        parsed.setdefault("jobs", {})
        parsed.setdefault("post_jobs", {})
        return parsed

    def _save(self) -> None:
        self.state_file.write_text(json.dumps(self._state, ensure_ascii=False), encoding="utf-8")

    def create_job(self, post_id: str, job: dict[str, Any]) -> None:
        self._state["jobs"][job["id"]] = job
        post_jobs = self._state["post_jobs"].setdefault(post_id, [])
        if job["id"] not in post_jobs:
            post_jobs.append(job["id"])
        self._save()

    def update_job(self, post_id: str, job: dict[str, Any]) -> None:
        if job["id"] not in self._state["jobs"]:
            raise KeyError(f"Job {job['id']} does not exist")
        self._state["jobs"][job["id"]] = job
        post_jobs = self._state["post_jobs"].setdefault(post_id, [])
        if job["id"] not in post_jobs:
            post_jobs.append(job["id"])
        self._save()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        return self._state["jobs"].get(job_id)

    def list_jobs(self, post_id: str) -> list[dict[str, Any]]:
        ids = self._state["post_jobs"].get(post_id, [])
        jobs = [self._state["jobs"][job_id] for job_id in ids if job_id in self._state["jobs"]]
        return sorted(jobs, key=lambda job: job["createdAt"], reverse=True)


class BrandKitOverride(BaseModel):
    primaryColor: str = Field(default="#4F46E5", pattern=r"^#([A-Fa-f0-9]{6})$")
    secondaryColor: str = Field(default="#9333EA", pattern=r"^#([A-Fa-f0-9]{6})$")
    accentColor: str = Field(default="#F59E0B", pattern=r"^#([A-Fa-f0-9]{6})$")
    backgroundColor: str = Field(default="#FFFFFF", pattern=r"^#([A-Fa-f0-9]{6})$")
    textColor: str = Field(default="#111827", pattern=r"^#([A-Fa-f0-9]{6})$")
    headingFont: str = "Inter"
    bodyFont: str = "Inter"
    logoUrl: HttpUrl | None = None


class ProviderPreferences(BaseModel):
    mode: Literal["auto", "internal_only", "external_preferred"] = "auto"
    preferredProviders: list[Literal["internal", "stitch", "twentyfirst", "external_subagent"]] | None = None


class CompatGenerateRequest(BaseModel):
    inputText: str
    designGuidelines: str
    platform: Literal["instagram_feed_1x1", "instagram_feed_4x5"]
    brandKit: BrandKitOverride | None = None
    variantCount: int | None = Field(default=None, ge=1, le=5)
    providerPreferences: ProviderPreferences | None = None


class SuggestRequest(BaseModel):
    reviewer: str
    instruction: str


class SelectVariantRequest(BaseModel):
    variantId: str


class ApproveRequest(BaseModel):
    reviewer: str


class RejectRequest(BaseModel):
    reviewer: str
    reason: str


class NativeBrandKit(BaseModel):
    colors: dict[str, str]
    fonts: dict[str, str]
    logo_url: str | None = None


class NativeGuidelines(BaseModel):
    objective: str
    angle: str
    audience: str
    tone: str
    hierarchy_notes: str


class NativeGenerateRequest(BaseModel):
    base_text: str
    guidelines: NativeGuidelines
    brand_kit: NativeBrandKit
    format: str = "1080x1080"
    num_variants: int = Field(default=3, ge=1, le=5)
    webhook_url: str | None = None


class NativeStructuredFeedback(BaseModel):
    variant_id: int
    action: Literal["approve", "revise"]
    changes: list[dict[str, Any]] = Field(default_factory=list)


def to_native_brand_kit(brand_kit: BrandKitOverride) -> NativeBrandKit:
    return NativeBrandKit(
        colors={
            "primary": brand_kit.primaryColor,
            "secondary": brand_kit.secondaryColor,
            "accent": brand_kit.accentColor,
            "bg": brand_kit.backgroundColor,
            "text": brand_kit.textColor,
        },
        fonts={
            "heading": brand_kit.headingFont,
            "body": brand_kit.bodyFont,
        },
        logo_url=str(brand_kit.logoUrl) if brand_kit.logoUrl else None,
    )


def enrich_variant(
    *,
    variant_index: int,
    file_path: str,
    score_data: dict[str, Any],
    brand_kit: BrandKitOverride,
    content: dict[str, Any],
    platform: str,
) -> dict[str, Any]:
    width, height = infer_platform_dimensions(platform)
    overall = clamp(to_float(score_data.get("score"), 7.0), 0.0, 10.0)
    label = f"Variant {variant_index + 1}"
    variant_id = str(uuid.uuid4())
    align = "left" if variant_index % 2 == 0 else "center"
    cta_style = "solid" if variant_index % 2 == 0 else "outline"
    background = {
        "gradientStart": brand_kit.primaryColor,
        "gradientEnd": brand_kit.secondaryColor,
        "overlayOpacity": 0.22 + (variant_index * 0.03),
        "highlightColor": brand_kit.accentColor,
        "moodSummary": score_data.get("critique", "Balanced hierarchy with clear CTA."),
    }
    layout = {
        "textAlign": align,
        "headlineSize": 84 if platform == "instagram_feed_1x1" else 88,
        "bodySize": 34,
        "ctaSize": 36,
        "padding": 72 if platform == "instagram_feed_1x1" else 82,
        "lineClampHeadline": 3,
        "lineClampBody": 4,
        "ctaStyle": cta_style,
        "surfaceStyle": "glass" if variant_index % 3 == 0 else "solid",
        "contentWidthRatio": 0.84 if align == "left" else 0.9,
    }
    critic = {
        "contrast": clamp(overall + 0.2, 0.0, 10.0),
        "hierarchy": clamp(overall + 0.1, 0.0, 10.0),
        "brandConsistency": clamp(overall - 0.1, 0.0, 10.0),
        "textDensity": clamp(overall - 0.3, 0.0, 10.0),
        "overall": overall,
        "rationale": score_data.get("critique", "Strong visual hierarchy and CTA."),
        "risks": score_data.get("weaknesses", []),
    }
    asset_url = build_public_asset_url(file_path)
    return {
        "id": variant_id,
        "provider": "internal",
        "label": label,
        "background": background,
        "layout": layout,
        "decorativeLayers": [],
        "badges": [],
        "logoPlacement": {
            "enabled": bool(brand_kit.logoUrl),
            "position": "top_left",
            "size": 120,
            "style": "badge",
        },
        "critic": critic,
        "rationale": score_data.get("critique", ""),
        "asset": {
            "filename": Path(file_path).name,
            "filePath": str(Path(file_path).resolve()),
            "relativeUrl": asset_url,
            "width": width,
            "height": height,
        },
        "componentSpec": {
            "platform": platform,
            "width": width,
            "height": height,
            "content": content,
            "background": background,
            "layout": layout,
            "brandKit": {
                "primaryColor": brand_kit.primaryColor,
                "secondaryColor": brand_kit.secondaryColor,
                "accentColor": brand_kit.accentColor,
                "backgroundColor": brand_kit.backgroundColor,
                "textColor": brand_kit.textColor,
                "headingFont": brand_kit.headingFont,
                "bodyFont": brand_kit.bodyFont,
                "logoUrl": str(brand_kit.logoUrl) if brand_kit.logoUrl else None,
            },
            "decorativeLayers": [],
            "badges": [],
            "logoPlacement": {
                "enabled": bool(brand_kit.logoUrl),
                "position": "top_left",
                "size": 120,
                "style": "badge",
            },
            "critic": critic,
            "variantMeta": {
                "id": variant_id,
                "provider": "internal",
                "label": label,
                "rationale": score_data.get("critique", ""),
            },
        },
    }


async def generate_html_layouts(
    *,
    base_text: str,
    guidelines: NativeGuidelines,
    brand_kit: NativeBrandKit,
    format_str: str,
    num_variants: int,
    format_constraints: dict[str, int],
) -> list[str]:
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    prompt = f"""Generate {num_variants} production-ready HTML/CSS layouts for an Instagram {format_str} image.
Brand Kit: {brand_kit.model_dump_json()}
Guidelines: {guidelines.model_dump_json()}
Text: "{base_text}"
Requirements:
- Return only JSON object with key "html_layouts" containing exactly {num_variants} strings.
- Each layout must be self-contained HTML fragment suitable for embedding in <body>.
- CTA must be visually dominant and use provided text intent.
- Use provided colors and fonts.
- Enforce these hard text limits for {format_str}: hook <= {format_constraints['hookMaxChars']} chars, headline <= {format_constraints['headlineMaxChars']} chars, body <= {format_constraints['bodyMaxChars']} chars, cta <= {format_constraints['ctaMaxChars']} chars.
- Keep all text fully visible in-canvas; never allow overflow outside the {format_str} viewport.
- Headline must use max {format_constraints['maxHeadlineLines']} lines and body max {format_constraints['maxBodyLines']} lines (truncate/summarize if needed).
- Use CSS overflow controls (line-clamp/ellipsis/wrapping) to guarantee fit.
- No markdown fences."""
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.8,
    )
    raw = response.choices[0].message.content or "{}"
    parsed = json.loads(raw)
    html_layouts = parsed.get("html_layouts")
    if not isinstance(html_layouts, list) or not html_layouts:
        raise HTTPException(status_code=502, detail="Invalid HTML layouts response from model.")
    valid_layouts = [layout for layout in html_layouts if isinstance(layout, str) and layout.strip()]
    if not valid_layouts:
        raise HTTPException(status_code=502, detail="Model returned empty HTML layouts.")
    return valid_layouts[:num_variants]


def map_job_response(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "jobId": job["id"],
        "status": job["status"],
        "previewUrl": job["asset"]["relativeUrl"],
        "revisionOfJobId": job.get("revisionOfJobId"),
        "recommendedVariantId": job.get("recommendedVariantId"),
        "variants": [
            {
                "id": variant["id"],
                "provider": variant["provider"],
                "label": variant["label"],
                "overallScore": variant.get("critic", {}).get("overall", 0),
            }
            for variant in job.get("variants", [])
        ],
    }


@asynccontextmanager
async def lifespan(_: FastAPI):
    output_dir = Path(os.getenv("RENDER_OUTPUT_DIR", "output"))
    output_dir.mkdir(parents=True, exist_ok=True)
    yield


output_dir = Path(os.getenv("RENDER_OUTPUT_DIR", "output"))
output_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="BrandForge AI Image Generator", lifespan=lifespan)
app.mount("/output", StaticFiles(directory=str(output_dir)), name="output")

state_file = os.getenv("AGENT_STATE_FILE", str(output_dir / "jobs-state.json"))
store = JsonStateStore(state_file=state_file)


async def create_job_from_compat_request(
    *,
    post_id: str,
    payload: CompatGenerateRequest,
    revision_of_job_id: str | None = None,
    revision_request: dict[str, Any] | None = None,
) -> dict[str, Any]:
    brand_kit = payload.brandKit or BrandKitOverride()
    format_str = format_from_platform(payload.platform)
    format_constraints = text_constraints_for_format(format_str)
    constrained_input_text = constrain_input_text_for_format(payload.inputText, format_str)
    max_variants = int(os.getenv("MAX_VARIANT_COUNT", "5"))
    variant_count = min(payload.variantCount or int(os.getenv("DEFAULT_VARIANT_COUNT", "3")), max_variants)
    guidelines_dict = parse_guidelines(payload.designGuidelines)
    native_guidelines = NativeGuidelines(**guidelines_dict)
    native_brand_kit = to_native_brand_kit(brand_kit)

    html_layouts = await generate_html_layouts(
        base_text=constrained_input_text,
        guidelines=native_guidelines,
        brand_kit=native_brand_kit,
        format_str=format_str,
        num_variants=variant_count,
        format_constraints=format_constraints,
    )
    rendered = await render_and_validate(html_layouts, native_brand_kit, format_str)
    scores = await auto_judge_variants(
        rendered["paths"],
        native_guidelines.model_dump(),
        native_brand_kit.model_dump(),
    )

    content = infer_content(constrained_input_text, payload.designGuidelines)
    variants: list[dict[str, Any]] = []
    for index, file_path in enumerate(rendered["paths"]):
        score = scores[index] if index < len(scores) else {"score": 7.0, "critique": "Scored by fallback."}
        variant = enrich_variant(
            variant_index=index,
            file_path=file_path,
            score_data=score,
            brand_kit=brand_kit,
            content=content,
            platform=payload.platform,
        )
        variants.append(variant)

    if not variants:
        raise HTTPException(status_code=500, detail="No variants were generated.")

    recommended_variant = max(variants, key=lambda item: item["critic"]["overall"])
    selected_variant = recommended_variant
    now = utc_now()
    input_payload = payload.model_dump()
    input_payload["postId"] = post_id
    if input_payload.get("brandKit") is None:
        input_payload["brandKit"] = brand_kit.model_dump()

    job = {
        "id": str(uuid.uuid4()),
        "threadId": str(uuid.uuid4()),
        "status": "pending_approval",
        "input": input_payload,
        "content": content,
        "background": selected_variant["background"],
        "layout": selected_variant["layout"],
        "componentSpec": selected_variant["componentSpec"],
        "variants": [
            {
                "id": variant["id"],
                "provider": variant["provider"],
                "label": variant["label"],
                "background": variant["background"],
                "layout": variant["layout"],
                "decorativeLayers": variant["decorativeLayers"],
                "badges": variant["badges"],
                "logoPlacement": variant["logoPlacement"],
                "critic": variant["critic"],
                "rationale": variant["rationale"],
            }
            for variant in variants
        ],
        "recommendedVariantId": recommended_variant["id"],
        "selectedVariantId": selected_variant["id"],
        "providerWarnings": [],
        "asset": selected_variant["asset"],
        "approval": None,
        "revisionOfJobId": revision_of_job_id,
        "revisionRequest": revision_request,
        "createdAt": now,
        "updatedAt": now,
        "postId": post_id,
        "variantAssets": {variant["id"]: variant["asset"] for variant in variants},
        "variantComponentSpecs": {variant["id"]: variant["componentSpec"] for variant in variants},
    }
    store.create_job(post_id, job)
    return job


def get_post_job_or_404(post_id: str, job_id: str) -> dict[str, Any]:
    job = store.get_job(job_id)
    if not job or job.get("postId") != post_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


def resolve_selected_variant(job: dict[str, Any]) -> dict[str, Any]:
    selected_id = job.get("selectedVariantId")
    for variant in job.get("variants", []):
        if variant["id"] == selected_id:
            return variant
    raise HTTPException(status_code=500, detail="Selected variant is invalid.")


@app.post("/v1/posts/{post_id}/images/generate")
async def compat_generate(post_id: str, payload: CompatGenerateRequest):
    job = await create_job_from_compat_request(post_id=post_id, payload=payload)
    return map_job_response(job)


@app.get("/v1/posts/{post_id}/images")
async def compat_list_jobs(post_id: str):
    jobs = store.list_jobs(post_id)
    return [
        {
            key: value
            for key, value in job.items()
            if key not in {"postId", "threadId", "variantAssets", "variantComponentSpecs"}
        }
        for job in jobs
    ]


@app.get("/v1/posts/{post_id}/images/{job_id}")
async def compat_get_job(post_id: str, job_id: str):
    job = get_post_job_or_404(post_id, job_id)
    return {
        key: value
        for key, value in job.items()
        if key not in {"postId", "threadId", "variantAssets", "variantComponentSpecs"}
    }


@app.get("/v1/posts/{post_id}/images/{job_id}/component-spec")
async def compat_get_component_spec(post_id: str, job_id: str):
    job = get_post_job_or_404(post_id, job_id)
    selected_variant = resolve_selected_variant(job)
    specs = job.get("variantComponentSpecs", {})
    component_spec = specs.get(selected_variant["id"])
    if not component_spec:
        raise HTTPException(status_code=404, detail="Component spec not available.")
    return component_spec


@app.post("/v1/posts/{post_id}/images/{job_id}/select-variant")
async def compat_select_variant(post_id: str, job_id: str, payload: SelectVariantRequest):
    job = get_post_job_or_404(post_id, job_id)
    selected_variant = None
    for variant in job.get("variants", []):
        if variant["id"] == payload.variantId:
            selected_variant = variant
            break
    if not selected_variant:
        raise HTTPException(status_code=404, detail="Variant not found.")
    job["selectedVariantId"] = payload.variantId
    job["background"] = selected_variant["background"]
    job["layout"] = selected_variant["layout"]
    job["componentSpec"] = job.get("variantComponentSpecs", {}).get(payload.variantId)
    job["asset"] = job.get("variantAssets", {}).get(payload.variantId)
    job["updatedAt"] = utc_now()
    store.update_job(post_id, job)
    return {
        key: value
        for key, value in job.items()
        if key not in {"postId", "threadId", "variantAssets", "variantComponentSpecs"}
    }


@app.get("/v1/posts/{post_id}/approvals/pending")
async def compat_get_pending_approvals(post_id: str):
    jobs = store.list_jobs(post_id)
    pending = [job for job in jobs if job.get("status") == "pending_approval"]
    return [
        {
            key: value
            for key, value in job.items()
            if key not in {"postId", "threadId", "variantAssets", "variantComponentSpecs"}
        }
        for job in pending
    ]


@app.post("/v1/posts/{post_id}/approvals/{job_id}/approve")
async def compat_approve(post_id: str, job_id: str, payload: ApproveRequest):
    job = get_post_job_or_404(post_id, job_id)
    if job["status"] not in {"pending_approval", "approved"}:
        raise HTTPException(status_code=409, detail="Only pending jobs can be approved.")
    job["status"] = "approved"
    job["approval"] = {
        "reviewer": payload.reviewer,
        "reviewedAt": utc_now(),
    }
    job["updatedAt"] = utc_now()
    store.update_job(post_id, job)
    return {
        key: value
        for key, value in job.items()
        if key not in {"postId", "threadId", "variantAssets", "variantComponentSpecs"}
    }


@app.post("/v1/posts/{post_id}/approvals/{job_id}/reject")
async def compat_reject(post_id: str, job_id: str, payload: RejectRequest):
    job = get_post_job_or_404(post_id, job_id)
    if job["status"] not in {"pending_approval", "approved"}:
        raise HTTPException(status_code=409, detail="Only pending/approved jobs can be rejected.")
    job["status"] = "rejected"
    job["approval"] = {
        "reviewer": payload.reviewer,
        "reviewedAt": utc_now(),
        "reason": payload.reason,
    }
    job["updatedAt"] = utc_now()
    store.update_job(post_id, job)
    return {
        key: value
        for key, value in job.items()
        if key not in {"postId", "threadId", "variantAssets", "variantComponentSpecs"}
    }


@app.post("/v1/posts/{post_id}/images/{job_id}/suggest")
async def compat_suggest(post_id: str, job_id: str, payload: SuggestRequest):
    base_job = get_post_job_or_404(post_id, job_id)
    input_payload = base_job.get("input", {})
    generate_payload = CompatGenerateRequest(
        inputText=input_payload.get("inputText", ""),
        designGuidelines=f"{input_payload.get('designGuidelines', '')}\nRevision request: {payload.instruction}",
        platform=input_payload.get("platform", "instagram_feed_1x1"),
        brandKit=BrandKitOverride(**input_payload.get("brandKit", {})),
        variantCount=input_payload.get("variantCount"),
        providerPreferences=ProviderPreferences(**input_payload.get("providerPreferences", {}))
        if input_payload.get("providerPreferences")
        else None,
    )
    revision_request = {
        "reviewer": payload.reviewer,
        "instruction": payload.instruction,
        "requestedAt": utc_now(),
    }
    new_job = await create_job_from_compat_request(
        post_id=post_id,
        payload=generate_payload,
        revision_of_job_id=job_id,
        revision_request=revision_request,
    )
    return map_job_response(new_job)


@app.get("/v1/posts/{post_id}/images/{job_id}/deliver")
async def compat_deliver(post_id: str, job_id: str):
    job = get_post_job_or_404(post_id, job_id)
    if job["status"] not in {"approved", "delivered"}:
        raise HTTPException(status_code=409, detail="Job must be approved before delivery.")
    selected_asset = job.get("asset")
    if not selected_asset:
        raise HTTPException(status_code=500, detail="Selected asset missing for delivery.")
    job["status"] = "delivered"
    job["updatedAt"] = utc_now()
    store.update_job(post_id, job)
    return {"deliveryUrl": selected_asset["relativeUrl"], "status": job["status"]}


@app.post("/generate")
async def native_generate(payload: NativeGenerateRequest):
    compat_payload = CompatGenerateRequest(
        inputText=payload.base_text,
        designGuidelines=payload.guidelines.hierarchy_notes,
        platform="instagram_feed_4x5" if payload.format == "1080x1350" else "instagram_feed_1x1",
        brandKit=BrandKitOverride(
            primaryColor=payload.brand_kit.colors.get("primary", "#4F46E5"),
            secondaryColor=payload.brand_kit.colors.get("secondary", "#9333EA"),
            accentColor=payload.brand_kit.colors.get("accent", "#F59E0B"),
            backgroundColor=payload.brand_kit.colors.get("bg", "#FFFFFF"),
            textColor=payload.brand_kit.colors.get("text", "#111827"),
            headingFont=payload.brand_kit.fonts.get("heading", "Inter"),
            bodyFont=payload.brand_kit.fonts.get("body", "Inter"),
            logoUrl=payload.brand_kit.logo_url,
        ),
        variantCount=payload.num_variants,
    )
    job = await create_job_from_compat_request(post_id="native", payload=compat_payload)
    preview = {
        "status": "awaiting_review",
        "variants": [
            {
                "id": index,
                "url": variant_asset["relativeUrl"],
                "score": job["variants"][index]["critic"]["overall"],
                "critique": job["variants"][index]["critic"]["rationale"],
            }
            for index, variant_asset in enumerate(job["variantAssets"].values())
        ],
    }
    return {
        "status": "awaiting_feedback",
        "thread_id": job["id"],
        "preview": preview,
        "webhook": payload.webhook_url,
    }


@app.post("/resume")
async def native_resume(thread_id: str, feedback: NativeStructuredFeedback):
    job = store.get_job(thread_id)
    if not job:
        raise HTTPException(status_code=404, detail="thread_id not found")

    if feedback.action == "approve":
        if feedback.variant_id < 0 or feedback.variant_id >= len(job["variants"]):
            raise HTTPException(status_code=400, detail="Invalid variant_id")
        selected_variant = job["variants"][feedback.variant_id]
        job["selectedVariantId"] = selected_variant["id"]
        job["asset"] = job["variantAssets"][selected_variant["id"]]
        job["status"] = "delivered"
        job["updatedAt"] = utc_now()
        store.update_job(job["postId"], job)
        return {
            "status": "completed",
            "final_variant": feedback.variant_id,
            "image_url": job["asset"]["relativeUrl"],
        }

    revision_text = "; ".join(
        change.get("instruction", "") for change in feedback.changes if isinstance(change, dict)
    ).strip()
    if not revision_text:
        revision_text = "Please revise current design while preserving brand hierarchy."
    input_payload = job.get("input", {})
    compat_payload = CompatGenerateRequest(
        inputText=input_payload.get("inputText", ""),
        designGuidelines=f"{input_payload.get('designGuidelines', '')}\nRevision request: {revision_text}",
        platform=input_payload.get("platform", "instagram_feed_1x1"),
        brandKit=BrandKitOverride(**input_payload.get("brandKit", {})),
        variantCount=input_payload.get("variantCount"),
        providerPreferences=ProviderPreferences(**input_payload.get("providerPreferences", {}))
        if input_payload.get("providerPreferences")
        else None,
    )
    revised_job = await create_job_from_compat_request(
        post_id=job["postId"],
        payload=compat_payload,
        revision_of_job_id=job["id"],
        revision_request={
            "reviewer": "native-resume",
            "instruction": revision_text,
            "requestedAt": utc_now(),
        },
    )
    preview = {
        "status": "awaiting_review",
        "variants": [
            {
                "id": index,
                "url": variant_asset["relativeUrl"],
                "score": revised_job["variants"][index]["critic"]["overall"],
                "critique": revised_job["variants"][index]["critic"]["rationale"],
            }
            for index, variant_asset in enumerate(revised_job["variantAssets"].values())
        ],
    }
    return {"status": "awaiting_feedback", "thread_id": revised_job["id"], "preview": preview}
