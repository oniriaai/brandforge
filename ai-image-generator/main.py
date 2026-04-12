import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from pipeline import (
    create_job_from_compat_request,
    get_post_job_or_404,
    map_job_response,
    public_job_payload,
    resolve_selected_variant,
    utc_now,
)
from schemas import (
    ApproveRequest,
    BrandKitOverride,
    CompatGenerateRequest,
    NativeGenerateRequest,
    NativeStructuredFeedback,
    ProviderPreferences,
    RejectRequest,
    SelectVariantRequest,
    SuggestRequest,
)
from state_store import JsonStateStore


@asynccontextmanager
async def lifespan(_: FastAPI):
    output = Path(os.getenv("RENDER_OUTPUT_DIR", "output"))
    output.mkdir(parents=True, exist_ok=True)
    yield


output_dir = Path(os.getenv("RENDER_OUTPUT_DIR", "output"))
output_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="BrandForge AI Image Generator", lifespan=lifespan)
app.mount("/output", StaticFiles(directory=str(output_dir)), name="output")

state_file = os.getenv("AGENT_STATE_FILE", "state/jobs-state.json")
store = JsonStateStore(state_file=state_file)


def build_compat_payload_from_input(
    input_payload: dict[str, Any],
    *,
    revision_instruction: str | None = None,
) -> CompatGenerateRequest:
    base_guidelines = str(input_payload.get("designGuidelines", "")).strip()
    if revision_instruction:
        design_guidelines = f"{base_guidelines}\nRevision request: {revision_instruction}".strip()
    else:
        design_guidelines = base_guidelines
    brand_kit_payload = input_payload.get("brandKit") or {}
    provider_preferences_payload = input_payload.get("providerPreferences")
    provider_preferences = (
        ProviderPreferences(**provider_preferences_payload)
        if isinstance(provider_preferences_payload, dict)
        else None
    )
    return CompatGenerateRequest(
        inputText=str(input_payload.get("inputText", "")),
        designGuidelines=design_guidelines,
        platform=input_payload.get("platform", "instagram_feed_1x1"),
        brandKit=BrandKitOverride(**brand_kit_payload),
        variantCount=input_payload.get("variantCount"),
        providerPreferences=provider_preferences,
    )


def build_compat_payload_from_native(payload: NativeGenerateRequest) -> CompatGenerateRequest:
    return CompatGenerateRequest(
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


@app.post("/v1/posts/{post_id}/images/generate")
async def compat_generate(post_id: str, payload: CompatGenerateRequest):
    job = await create_job_from_compat_request(post_id=post_id, payload=payload, store=store)
    return map_job_response(job)


@app.get("/v1/posts/{post_id}/images")
async def compat_list_jobs(post_id: str):
    jobs = store.list_jobs(post_id)
    return [public_job_payload(job) for job in jobs]


@app.get("/v1/posts/{post_id}/images/{job_id}")
async def compat_get_job(post_id: str, job_id: str):
    job = get_post_job_or_404(post_id, job_id, store)
    return public_job_payload(job)


@app.get("/v1/posts/{post_id}/images/{job_id}/component-spec")
async def compat_get_component_spec(post_id: str, job_id: str):
    job = get_post_job_or_404(post_id, job_id, store)
    selected_variant = resolve_selected_variant(job)
    specs = job.get("variantComponentSpecs", {})
    component_spec = specs.get(selected_variant["id"])
    if not component_spec:
        raise HTTPException(status_code=404, detail="Component spec not available.")
    return component_spec


@app.post("/v1/posts/{post_id}/images/{job_id}/select-variant")
async def compat_select_variant(post_id: str, job_id: str, payload: SelectVariantRequest):
    job = get_post_job_or_404(post_id, job_id, store)
    selected_variant = next((variant for variant in job.get("variants", []) if variant["id"] == payload.variantId), None)
    if not selected_variant:
        raise HTTPException(status_code=404, detail="Variant not found.")
    job["selectedVariantId"] = payload.variantId
    job["background"] = selected_variant["background"]
    job["layout"] = selected_variant["layout"]
    job["componentSpec"] = job.get("variantComponentSpecs", {}).get(payload.variantId)
    job["asset"] = job.get("variantAssets", {}).get(payload.variantId)
    job["updatedAt"] = utc_now()
    store.update_job(post_id, job)
    return public_job_payload(job)


@app.get("/v1/posts/{post_id}/approvals/pending")
async def compat_get_pending_approvals(post_id: str):
    jobs = store.list_jobs(post_id)
    pending = [job for job in jobs if job.get("status") == "pending_approval"]
    return [public_job_payload(job) for job in pending]


@app.post("/v1/posts/{post_id}/approvals/{job_id}/approve")
async def compat_approve(post_id: str, job_id: str, payload: ApproveRequest):
    job = get_post_job_or_404(post_id, job_id, store)
    if job["status"] not in {"pending_approval", "approved"}:
        raise HTTPException(status_code=409, detail="Only pending jobs can be approved.")
    job["status"] = "approved"
    job["approval"] = {
        "reviewer": payload.reviewer,
        "reviewedAt": utc_now(),
    }
    job["updatedAt"] = utc_now()
    store.update_job(post_id, job)
    return public_job_payload(job)


@app.post("/v1/posts/{post_id}/approvals/{job_id}/reject")
async def compat_reject(post_id: str, job_id: str, payload: RejectRequest):
    job = get_post_job_or_404(post_id, job_id, store)
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
    return public_job_payload(job)


@app.post("/v1/posts/{post_id}/images/{job_id}/suggest")
async def compat_suggest(post_id: str, job_id: str, payload: SuggestRequest):
    base_job = get_post_job_or_404(post_id, job_id, store)
    input_payload = base_job.get("input", {})
    generate_payload = build_compat_payload_from_input(
        input_payload,
        revision_instruction=payload.instruction,
    )
    revision_request = {
        "reviewer": payload.reviewer,
        "instruction": payload.instruction,
        "requestedAt": utc_now(),
    }
    new_job = await create_job_from_compat_request(
        post_id=post_id,
        payload=generate_payload,
        store=store,
        revision_of_job_id=job_id,
        revision_request=revision_request,
    )
    return map_job_response(new_job)


@app.get("/v1/posts/{post_id}/images/{job_id}/deliver")
async def compat_deliver(post_id: str, job_id: str):
    job = get_post_job_or_404(post_id, job_id, store)
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
    compat_payload = build_compat_payload_from_native(payload)
    job = await create_job_from_compat_request(post_id="native", payload=compat_payload, store=store)
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
    compat_payload = build_compat_payload_from_input(
        input_payload,
        revision_instruction=revision_text,
    )
    revised_job = await create_job_from_compat_request(
        post_id=job["postId"],
        payload=compat_payload,
        store=store,
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


__all__ = ["app", "store", "JsonStateStore"]
