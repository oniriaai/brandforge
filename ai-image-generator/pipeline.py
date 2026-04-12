import copy
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from openai import APIConnectionError, APIError, APITimeoutError, RateLimitError

from background_generator import build_procedural_seed, generate_procedural_background
from baseline import QUALITY_BASELINE_THRESHOLDS, compute_quality_snapshot
from internal_models import GeneratedVariant, StoredJob, StoredVariant, VariantAsset
from judge import auto_judge_variants
from openai_client import create_openai_client
from renderer import render_and_validate
from schemas import (
    BrandKitOverride,
    CompatGenerateRequest,
    NativeBrandKit,
    NativeGuidelines,
)
from state_store import JsonStateStore

LUCIDE_CDN_BASE = "https://unpkg.com/lucide-static/icons"
UNDRAW_CDN_COMMIT = "396e77e2db64cf8f0116ab44f1643c84c6b9e1fe"
UNDRAW_CDN_BASE = (
    f"https://raw.githubusercontent.com/AnandChowdhary/undrawcdn/{UNDRAW_CDN_COMMIT}/illustrations"
)

LUCIDE_ICON_CATALOG: list[dict[str, Any]] = [
    {
        "name": "rocket",
        "purpose": "launch momentum",
        "url": f"{LUCIDE_CDN_BASE}/rocket.svg",
        "keywords": ["launch", "growth", "speed", "startup", "new"],
    },
    {
        "name": "target",
        "purpose": "precision and outcomes",
        "url": f"{LUCIDE_CDN_BASE}/target.svg",
        "keywords": ["conversion", "leads", "results", "performance", "objective"],
    },
    {
        "name": "megaphone",
        "purpose": "announcement and reach",
        "url": f"{LUCIDE_CDN_BASE}/megaphone.svg",
        "keywords": ["awareness", "engagement", "social", "reach", "campaign"],
    },
    {
        "name": "shield-check",
        "purpose": "trust and reliability",
        "url": f"{LUCIDE_CDN_BASE}/shield-check.svg",
        "keywords": ["authority", "trust", "reliability", "security", "proof"],
    },
    {
        "name": "sparkles",
        "purpose": "premium highlight",
        "url": f"{LUCIDE_CDN_BASE}/sparkles.svg",
        "keywords": ["brand", "premium", "creative", "quality", "elegant"],
    },
    {
        "name": "zap",
        "purpose": "speed and urgency",
        "url": f"{LUCIDE_CDN_BASE}/zap.svg",
        "keywords": ["urgent", "limited", "offer", "flash", "quick"],
    },
    {
        "name": "badge-dollar-sign",
        "purpose": "value and pricing highlight",
        "url": f"{LUCIDE_CDN_BASE}/badge-dollar-sign.svg",
        "keywords": ["pricing", "discount", "offer", "value", "conversion"],
    },
    {
        "name": "chart-no-axes-column",
        "purpose": "performance metric growth",
        "url": f"{LUCIDE_CDN_BASE}/chart-no-axes-column.svg",
        "keywords": ["analytics", "metrics", "kpi", "results", "growth"],
    },
    {
        "name": "chart-line",
        "purpose": "trend and progress narrative",
        "url": f"{LUCIDE_CDN_BASE}/chart-line.svg",
        "keywords": ["trend", "performance", "insights", "growth", "report"],
    },
    {
        "name": "circle-dollar-sign",
        "purpose": "revenue and roi focus",
        "url": f"{LUCIDE_CDN_BASE}/circle-dollar-sign.svg",
        "keywords": ["roi", "revenue", "sales", "conversion", "finance"],
    },
    {
        "name": "users",
        "purpose": "audience and community growth",
        "url": f"{LUCIDE_CDN_BASE}/users.svg",
        "keywords": ["audience", "community", "engagement", "social", "network"],
    },
    {
        "name": "user-plus",
        "purpose": "signup and lead acquisition",
        "url": f"{LUCIDE_CDN_BASE}/user-plus.svg",
        "keywords": ["signup", "leads", "acquisition", "join", "register"],
    },
    {
        "name": "handshake",
        "purpose": "trust and partnership",
        "url": f"{LUCIDE_CDN_BASE}/handshake.svg",
        "keywords": ["trust", "partnership", "authority", "b2b", "reliability"],
    },
    {
        "name": "briefcase-business",
        "purpose": "professional and enterprise positioning",
        "url": f"{LUCIDE_CDN_BASE}/briefcase-business.svg",
        "keywords": ["professional", "enterprise", "corporate", "authority", "business"],
    },
    {
        "name": "shopping-cart",
        "purpose": "ecommerce purchase intent",
        "url": f"{LUCIDE_CDN_BASE}/shopping-cart.svg",
        "keywords": ["shop", "buy", "commerce", "conversion", "checkout"],
    },
    {
        "name": "shopping-bag",
        "purpose": "retail offer framing",
        "url": f"{LUCIDE_CDN_BASE}/shopping-bag.svg",
        "keywords": ["retail", "offer", "sale", "shopping", "product"],
    },
    {
        "name": "mouse-pointer-click",
        "purpose": "interaction and clickthrough intent",
        "url": f"{LUCIDE_CDN_BASE}/mouse-pointer-click.svg",
        "keywords": ["click", "cta", "action", "engagement", "conversion"],
    },
    {
        "name": "bell-ring",
        "purpose": "alerts and launch announcements",
        "url": f"{LUCIDE_CDN_BASE}/bell-ring.svg",
        "keywords": ["announcement", "launch", "alert", "reach", "awareness"],
    },
    {
        "name": "calendar-check-2",
        "purpose": "booking and scheduling outcomes",
        "url": f"{LUCIDE_CDN_BASE}/calendar-check-2.svg",
        "keywords": ["book", "schedule", "demo", "appointment", "conversion"],
    },
    {
        "name": "trending-up",
        "purpose": "upward momentum signal",
        "url": f"{LUCIDE_CDN_BASE}/trending-up.svg",
        "keywords": ["growth", "trend", "performance", "momentum", "results"],
    },
    {
        "name": "gift",
        "purpose": "promotion and reward messaging",
        "url": f"{LUCIDE_CDN_BASE}/gift.svg",
        "keywords": ["promo", "bonus", "reward", "offer", "discount"],
    },
    {
        "name": "message-square-heart",
        "purpose": "social engagement and affinity",
        "url": f"{LUCIDE_CDN_BASE}/message-square-heart.svg",
        "keywords": ["engagement", "community", "social", "loyalty", "support"],
    },
]

UNDRAW_ILLUSTRATION_CATALOG: list[dict[str, Any]] = [
    {
        "name": "social-growth",
        "purpose": "campaign growth story",
        "url": f"{UNDRAW_CDN_BASE}/social-growth.svg",
        "keywords": ["growth", "social", "awareness", "engagement", "audience"],
    },
    {
        "name": "social-strategy",
        "purpose": "marketing strategy context",
        "url": f"{UNDRAW_CDN_BASE}/social-strategy.svg",
        "keywords": ["strategy", "authority", "planning", "professional", "b2b"],
    },
    {
        "name": "business-plan",
        "purpose": "business planning narrative",
        "url": f"{UNDRAW_CDN_BASE}/business-plan.svg",
        "keywords": ["planning", "authority", "lead_generation", "enterprise", "reliability"],
    },
    {
        "name": "maker-launch",
        "purpose": "product launch energy",
        "url": f"{UNDRAW_CDN_BASE}/maker-launch.svg",
        "keywords": ["launch", "conversion", "new", "product", "growth"],
    },
    {
        "name": "online-shopping",
        "purpose": "commerce conversion context",
        "url": f"{UNDRAW_CDN_BASE}/online-shopping.svg",
        "keywords": ["conversion", "shop", "buy", "offer", "sale"],
    },
    {
        "name": "design-tools",
        "purpose": "creative workflow context",
        "url": f"{UNDRAW_CDN_BASE}/design-tools.svg",
        "keywords": ["creative", "brand", "design", "storytelling", "content"],
    },
    {
        "name": "analytics",
        "purpose": "data-driven optimization story",
        "url": f"{UNDRAW_CDN_BASE}/analytics.svg",
        "keywords": ["analytics", "kpi", "performance", "reporting", "insights"],
    },
    {
        "name": "data-trends",
        "purpose": "trend-based growth narrative",
        "url": f"{UNDRAW_CDN_BASE}/data-trends.svg",
        "keywords": ["trend", "growth", "forecast", "analytics", "results"],
    },
    {
        "name": "dashboard",
        "purpose": "operational marketing cockpit",
        "url": f"{UNDRAW_CDN_BASE}/dashboard.svg",
        "keywords": ["dashboard", "metrics", "overview", "monitoring", "authority"],
    },
    {
        "name": "business-deal",
        "purpose": "deal closure and conversion",
        "url": f"{UNDRAW_CDN_BASE}/business-deal.svg",
        "keywords": ["conversion", "deal", "sales", "b2b", "partnership"],
    },
    {
        "name": "collaboration",
        "purpose": "team execution and alignment",
        "url": f"{UNDRAW_CDN_BASE}/collaboration.svg",
        "keywords": ["team", "collaboration", "workflow", "community", "engagement"],
    },
    {
        "name": "conversation",
        "purpose": "social interaction and communication",
        "url": f"{UNDRAW_CDN_BASE}/conversation.svg",
        "keywords": ["conversation", "social", "audience", "engagement", "communication"],
    },
    {
        "name": "creativity",
        "purpose": "creative campaign ideation",
        "url": f"{UNDRAW_CDN_BASE}/creativity.svg",
        "keywords": ["creative", "idea", "brand", "design", "storytelling"],
    },
    {
        "name": "design-process",
        "purpose": "iterative production process",
        "url": f"{UNDRAW_CDN_BASE}/design-process.svg",
        "keywords": ["process", "design", "workflow", "creative", "execution"],
    },
    {
        "name": "content",
        "purpose": "content-led marketing",
        "url": f"{UNDRAW_CDN_BASE}/content.svg",
        "keywords": ["content", "copy", "campaign", "engagement", "social"],
    },
    {
        "name": "celebration",
        "purpose": "achievement and milestone framing",
        "url": f"{UNDRAW_CDN_BASE}/celebration.svg",
        "keywords": ["celebration", "success", "achievement", "community", "social_proof"],
    },
    {
        "name": "customer-survey",
        "purpose": "feedback and social proof capture",
        "url": f"{UNDRAW_CDN_BASE}/customer-survey.svg",
        "keywords": ["feedback", "survey", "social_proof", "voice", "customer"],
    },
    {
        "name": "credit-card-payment",
        "purpose": "payment conversion intent",
        "url": f"{UNDRAW_CDN_BASE}/credit-card-payment.svg",
        "keywords": ["payment", "checkout", "buy", "conversion", "commerce"],
    },
    {
        "name": "cloud-hosting",
        "purpose": "technical product positioning",
        "url": f"{UNDRAW_CDN_BASE}/cloud-hosting.svg",
        "keywords": ["saas", "cloud", "technology", "infrastructure", "authority"],
    },
    {
        "name": "community",
        "purpose": "community-led engagement",
        "url": f"{UNDRAW_CDN_BASE}/community.svg",
        "keywords": ["community", "audience", "engagement", "social", "trust"],
    },
    {
        "name": "browser-stats",
        "purpose": "performance monitoring story",
        "url": f"{UNDRAW_CDN_BASE}/browser-stats.svg",
        "keywords": ["stats", "analytics", "metrics", "insights", "performance"],
    },
    {
        "name": "building-blocks",
        "purpose": "modular growth and capability building",
        "url": f"{UNDRAW_CDN_BASE}/building-blocks.svg",
        "keywords": ["build", "growth", "strategy", "foundation", "planning"],
    },
]

SEMANTIC_SYNONYMS: dict[str, list[str]] = {
    "lead_generation": ["leads", "signup", "register", "acquisition"],
    "conversion": ["buy", "shop", "checkout", "sales", "offer"],
    "awareness": ["reach", "visibility", "brand", "attention"],
    "engagement": ["community", "social", "interaction", "conversation"],
    "authority": ["expert", "professional", "trust", "enterprise"],
    "social_proof": ["testimonial", "reviews", "credibility", "customers"],
    "storytelling": ["narrative", "creative", "journey", "emotion"],
    "direct_sale": ["discount", "deal", "promo", "limited"],
    "pain_agitate_solve": ["problem", "solution", "urgent", "relief"],
}

VARIABLE_FONT_PRESETS: list[dict[str, Any]] = [
    {
        "name": "inter-variable-bold",
        "source": "variableCatalog",
        "headingFont": "Inter",
        "bodyFont": "Inter",
        "headlineWeight": 780,
        "bodyWeight": 470,
        "headlineVariationSettings": "'opsz' 32, 'wght' 780",
        "bodyVariationSettings": "'opsz' 14, 'wght' 470",
        "fontOpticalSizing": "auto",
    },
    {
        "name": "roboto-flex-editorial",
        "source": "variableCatalog",
        "headingFont": "Roboto Flex",
        "bodyFont": "Roboto Flex",
        "headlineWeight": 760,
        "bodyWeight": 450,
        "headlineVariationSettings": "'opsz' 40, 'wght' 760",
        "bodyVariationSettings": "'opsz' 14, 'wght' 450",
        "fontOpticalSizing": "auto",
    },
    {
        "name": "space-grotesk-display",
        "source": "variableCatalog",
        "headingFont": "Space Grotesk",
        "bodyFont": "Space Grotesk",
        "headlineWeight": 700,
        "bodyWeight": 430,
        "headlineVariationSettings": "'wght' 700",
        "bodyVariationSettings": "'wght' 430",
        "fontOpticalSizing": "auto",
    },
    {
        "name": "manrope-balanced",
        "source": "variableCatalog",
        "headingFont": "Manrope",
        "bodyFont": "Manrope",
        "headlineWeight": 760,
        "bodyWeight": 450,
        "headlineVariationSettings": "'wght' 760",
        "bodyVariationSettings": "'wght' 450",
        "fontOpticalSizing": "auto",
    },
]

INTERNAL_JOB_KEYS = {"postId", "threadId", "variantAssets", "variantComponentSpecs"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def emit_quality_log(stage: str, payload: dict[str, Any]) -> None:
    record = {
        "event": "quality_baseline",
        "stage": stage,
        "timestamp": utc_now(),
        "payload": payload,
    }
    print(json.dumps(record, ensure_ascii=False), flush=True)


def to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def env_int(
    name: str,
    default: int,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    raw = os.getenv(name)
    if raw is None:
        value = default
    else:
        try:
            value = int(raw)
        except ValueError:
            value = default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def stage_model(*stage_env_names: str) -> str:
    for env_name in stage_env_names:
        value = os.getenv(env_name)
        if value and value.strip():
            return value.strip()
    fallback = os.getenv("OPENAI_MODEL")
    return fallback.strip() if fallback and fallback.strip() else "gpt-4o"


def strict_json_response_format(name: str, schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {
            "name": name,
            "strict": True,
            "schema": schema,
        },
    }


def map_openai_error(stage: str, exc: Exception) -> HTTPException:
    if isinstance(exc, RateLimitError):
        return HTTPException(status_code=503, detail=f"OpenAI rate limit during {stage}.")
    if isinstance(exc, (APITimeoutError, APIConnectionError)):
        return HTTPException(status_code=504, detail=f"OpenAI unavailable during {stage}.")
    if isinstance(exc, APIError):
        return HTTPException(status_code=502, detail=f"OpenAI upstream error during {stage}.")
    return HTTPException(status_code=502, detail=f"Unexpected OpenAI failure during {stage}.")


def resolve_variant_count(requested_variant_count: int | None) -> int:
    max_variants = env_int("MAX_VARIANT_COUNT", 5, minimum=1)
    default_variants = env_int("DEFAULT_VARIANT_COUNT", 3, minimum=1, maximum=max_variants)
    requested = requested_variant_count if requested_variant_count is not None else default_variants
    return max(1, min(requested, max_variants))


def parse_model_json_object(raw: str, *, stage: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Malformed JSON from model during {stage}: {exc.msg}",
        ) from exc
    if not isinstance(parsed, dict):
        raise HTTPException(
            status_code=502,
            detail=f"Invalid model payload during {stage}: expected JSON object.",
        )
    return parsed


def extract_keywords(text: str, limit: int = 6) -> list[str]:
    tokens = re.findall(r"[A-Za-zÀ-ÿ0-9]{4,}", text.lower())
    deduped: list[str] = []
    for token in tokens:
        if token not in deduped:
            deduped.append(token)
        if len(deduped) >= limit:
            break
    return deduped


def combine_semantic_signals(
    *,
    objective: str,
    angle: str,
    audience: str,
    tone: str,
    keyword_signals: list[str],
) -> list[str]:
    raw = " ".join([objective, angle, audience, tone, *keyword_signals])
    tokens = extract_keywords(raw, limit=24)
    canonical_tokens = re.findall(r"[A-Za-z0-9_]{4,}", raw.lower())
    expanded: list[str] = []
    for token in canonical_tokens:
        if token not in expanded:
            expanded.append(token)
        for synonym in SEMANTIC_SYNONYMS.get(token, []):
            if synonym not in expanded:
                expanded.append(synonym)
    for token in tokens:
        if token not in expanded:
            expanded.append(token)
        for synonym in SEMANTIC_SYNONYMS.get(token, []):
            if synonym not in expanded:
                expanded.append(synonym)
        for synonym in SEMANTIC_SYNONYMS.get(token.replace("-", "_"), []):
            if synonym not in expanded:
                expanded.append(synonym)
        if len(expanded) >= 36:
            break
    return expanded[:36]


def rank_assets_by_relevance(catalog: list[dict[str, Any]], semantic_signals: list[str]) -> list[dict[str, Any]]:
    if not catalog:
        return []
    if not semantic_signals:
        return list(catalog)

    signal_set = {signal.lower().strip() for signal in semantic_signals if signal.strip()}

    def score(item: dict[str, Any]) -> tuple[int, int, str]:
        name = str(item.get("name", "")).lower()
        purpose = str(item.get("purpose", "")).lower()
        keyword_list = [str(token).lower() for token in item.get("keywords", []) if isinstance(token, str)]
        haystack = " ".join([name, purpose, " ".join(keyword_list)])
        exact_hits = 0
        partial_hits = 0
        for signal in signal_set:
            if not signal:
                continue
            if signal in keyword_list or signal == name:
                exact_hits += 1
                continue
            if signal in haystack:
                partial_hits += 1
        return (exact_hits, partial_hits, str(item.get("name", "")))

    scored = sorted(catalog, key=score, reverse=True)
    return scored


def repair_max_passes() -> int:
    return env_int("REPAIR_MAX_PASSES", 2, minimum=0, maximum=4)


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
    cta_candidates = [
        line
        for line in lines
        if any(word in line.lower() for word in ("demo", "agenda", "descubre", "comienza", "start", "book", "try", "join"))
    ]
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


def _font_key(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).lower()


def has_explicit_font_overrides(brand_kit: Any) -> bool:
    if brand_kit is None:
        return False
    defaults = BrandKitOverride()
    heading = _font_key(brand_kit.headingFont or "")
    body = _font_key(brand_kit.bodyFont or "")
    return bool(heading and heading != _font_key(defaults.headingFont)) or bool(
        body and body != _font_key(defaults.bodyFont)
    )


def typography_preset_for_variant(
    index: int,
    *,
    brand_kit: Any,
    lock_brand_fonts: bool,
) -> dict[str, Any]:
    if lock_brand_fonts:
        return {
            "name": "brand-kit-locked",
            "source": "brandKit",
            "headingFont": brand_kit.headingFont,
            "bodyFont": brand_kit.bodyFont,
            "headlineWeight": 760,
            "bodyWeight": 460,
            "headlineVariationSettings": "",
            "bodyVariationSettings": "",
            "fontOpticalSizing": "auto",
        }
    return dict(VARIABLE_FONT_PRESETS[index % len(VARIABLE_FONT_PRESETS)])


def build_variant_blueprints(
    platform: str,
    num_variants: int,
    *,
    brand_kit: Any,
    lock_brand_fonts: bool,
    semantic_signals: list[str],
) -> list[dict[str, Any]]:
    if num_variants <= 0:
        return []
    if platform == "instagram_feed_4x5":
        layout_cycle = [
            "split-vertical",
            "stacked-hero",
            "framed-poster",
            "story-column",
            "diagonal-spotlight",
        ]
    else:
        layout_cycle = [
            "split-horizontal",
            "centered-hero",
            "framed-card",
            "offset-panel",
            "diagonal-spotlight",
        ]

    text_align_cycle = ["left", "center", "left", "center"]
    surface_cycle = ["glass", "solid", "gradient", "outlined", "solid", "gradient"]
    density_cycle = ["minimal", "balanced", "expressive"]
    cta_cycle = ["solid", "outline", "pill", "solid"]
    ranked_icons = rank_assets_by_relevance(LUCIDE_ICON_CATALOG, semantic_signals)
    ranked_illustrations = rank_assets_by_relevance(UNDRAW_ILLUSTRATION_CATALOG, semantic_signals)
    icon_rotation = sum(len(signal) for signal in semantic_signals[:4]) % max(len(ranked_icons), 1)
    illustration_rotation = sum(ord(signal[0]) for signal in semantic_signals if signal) % max(
        len(ranked_illustrations), 1
    )
    style_rotation = sum(ord(char) for char in "".join(semantic_signals[:6])) % max(len(layout_cycle), 1)

    blueprints: list[dict[str, Any]] = []
    for index in range(num_variants):
        icon = ranked_icons[(icon_rotation + index) % len(ranked_icons)]
        illustration = ranked_illustrations[(illustration_rotation + index) % len(ranked_illustrations)]
        typography = typography_preset_for_variant(
            index,
            brand_kit=brand_kit,
            lock_brand_fonts=lock_brand_fonts,
        )
        blueprints.append(
            {
                "index": index,
                "layoutStyle": layout_cycle[(style_rotation + index) % len(layout_cycle)],
                "textAlign": text_align_cycle[(style_rotation + index) % len(text_align_cycle)],
                "surfaceStyle": surface_cycle[(style_rotation + index) % len(surface_cycle)],
                "assetDensity": density_cycle[index % len(density_cycle)],
                "ctaStyle": cta_cycle[(style_rotation + index) % len(cta_cycle)],
                "lucideIcon": icon,
                "unDrawIllustration": illustration,
                "typographyPreset": typography,
            }
        )
    return blueprints


def normalize_design_spec(
    raw_spec: Any,
    *,
    blueprint: dict[str, Any],
    format_constraints: dict[str, int],
) -> dict[str, Any]:
    source = raw_spec if isinstance(raw_spec, dict) else {}
    hierarchy_raw = source.get("hierarchy", {}) if isinstance(source.get("hierarchy"), dict) else {}
    cta_raw = source.get("cta", {}) if isinstance(source.get("cta"), dict) else {}
    visual_raw = source.get("visualStrategy", {}) if isinstance(source.get("visualStrategy"), dict) else {}
    text_policy_raw = source.get("textPolicy", {}) if isinstance(source.get("textPolicy"), dict) else {}

    supporting_visual_mode = str(visual_raw.get("supportingVisualMode", "auto")).strip().lower()
    if supporting_visual_mode not in {"logo", "illustration", "auto"}:
        supporting_visual_mode = "auto"

    return {
        "variantIndex": int(blueprint.get("index", 0)),
        "layoutTemplate": str(source.get("layoutTemplate", blueprint.get("layoutStyle", "split-horizontal"))),
        "surfaceStyle": str(source.get("surfaceStyle", blueprint.get("surfaceStyle", "solid"))),
        "textAlign": str(source.get("textAlign", blueprint.get("textAlign", "left"))),
        "hierarchy": {
            "headlinePriority": str(hierarchy_raw.get("headlinePriority", "dominant")),
            "bodyPriority": str(hierarchy_raw.get("bodyPriority", "supporting")),
            "ctaPriority": str(hierarchy_raw.get("ctaPriority", "high")),
        },
        "spacingScale": str(source.get("spacingScale", "comfortable")),
        "cta": {
            "placement": str(cta_raw.get("placement", "bottom")),
            "emphasis": str(cta_raw.get("emphasis", "high")),
            "style": str(cta_raw.get("style", blueprint.get("ctaStyle", "solid"))),
        },
        "textPolicy": {
            "maxHeadlineLines": int(
                to_float(text_policy_raw.get("maxHeadlineLines"), format_constraints.get("maxHeadlineLines", 2))
            ),
            "maxBodyLines": int(to_float(text_policy_raw.get("maxBodyLines"), format_constraints.get("maxBodyLines", 3))),
            "headlineMaxChars": int(
                to_float(text_policy_raw.get("headlineMaxChars"), format_constraints.get("headlineMaxChars", 72))
            ),
            "bodyMaxChars": int(to_float(text_policy_raw.get("bodyMaxChars"), format_constraints.get("bodyMaxChars", 140))),
            "ctaMaxChars": int(to_float(text_policy_raw.get("ctaMaxChars"), format_constraints.get("ctaMaxChars", 26))),
        },
        "visualStrategy": {
            "supportingVisualMode": supporting_visual_mode,
            "logoUsage": str(visual_raw.get("logoUsage", "selective")),
            "illustrationUsage": str(visual_raw.get("illustrationUsage", "selective")),
            "assetDensity": str(visual_raw.get("assetDensity", blueprint.get("assetDensity", "balanced"))),
        },
        "typographyIntent": {
            "headingRole": str(source.get("headingRole", "high-impact")),
            "bodyRole": str(source.get("bodyRole", "readable")),
        },
        "notes": str(source.get("notes", "")).strip(),
    }


def order_design_specs(
    raw_specs: list[Any],
    *,
    variant_blueprints: list[dict[str, Any]],
    format_constraints: dict[str, int],
) -> list[dict[str, Any]]:
    variant_count = len(variant_blueprints)
    indexed_specs: dict[int, dict[str, Any]] = {}
    for item in raw_specs:
        if not isinstance(item, dict):
            continue
        variant_index_raw = item.get("variantIndex")
        try:
            variant_index = int(variant_index_raw)
        except (TypeError, ValueError):
            continue
        if 0 <= variant_index < variant_count and variant_index not in indexed_specs:
            indexed_specs[variant_index] = item

    normalized_specs: list[dict[str, Any]] = []
    for index, blueprint in enumerate(variant_blueprints):
        raw_spec = indexed_specs.get(index)
        if raw_spec is None and index < len(raw_specs) and isinstance(raw_specs[index], dict):
            raw_spec = raw_specs[index]
        if raw_spec is None:
            raw_spec = {}
        normalized_specs.append(
            normalize_design_spec(
                raw_spec,
                blueprint=blueprint,
                format_constraints=format_constraints,
            )
        )
    return normalized_specs


def design_specs_response_schema(variant_count: int) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["design_specs"],
        "properties": {
            "design_specs": {
                "type": "array",
                "minItems": variant_count,
                "maxItems": variant_count,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "variantIndex",
                        "layoutTemplate",
                        "surfaceStyle",
                        "textAlign",
                        "hierarchy",
                        "spacingScale",
                        "cta",
                        "textPolicy",
                        "visualStrategy",
                        "headingRole",
                        "bodyRole",
                        "notes",
                    ],
                    "properties": {
                        "variantIndex": {"type": "integer", "minimum": 0},
                        "layoutTemplate": {"type": "string"},
                        "surfaceStyle": {"type": "string", "enum": ["glass", "solid", "gradient", "outlined"]},
                        "textAlign": {"type": "string", "enum": ["left", "center"]},
                        "hierarchy": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["headlinePriority", "bodyPriority", "ctaPriority"],
                            "properties": {
                                "headlinePriority": {"type": "string", "enum": ["dominant", "high", "balanced"]},
                                "bodyPriority": {"type": "string", "enum": ["supporting", "balanced", "compact"]},
                                "ctaPriority": {"type": "string", "enum": ["high", "medium"]},
                            },
                        },
                        "spacingScale": {"type": "string", "enum": ["compact", "comfortable", "airy"]},
                        "cta": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["placement", "emphasis", "style"],
                            "properties": {
                                "placement": {"type": "string", "enum": ["bottom", "inline", "footer"]},
                                "emphasis": {"type": "string", "enum": ["high", "medium"]},
                                "style": {"type": "string", "enum": ["solid", "outline", "pill"]},
                            },
                        },
                        "textPolicy": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "maxHeadlineLines",
                                "maxBodyLines",
                                "headlineMaxChars",
                                "bodyMaxChars",
                                "ctaMaxChars",
                            ],
                            "properties": {
                                "maxHeadlineLines": {"type": "integer", "minimum": 1, "maximum": 5},
                                "maxBodyLines": {"type": "integer", "minimum": 1, "maximum": 6},
                                "headlineMaxChars": {"type": "integer", "minimum": 20, "maximum": 180},
                                "bodyMaxChars": {"type": "integer", "minimum": 40, "maximum": 320},
                                "ctaMaxChars": {"type": "integer", "minimum": 10, "maximum": 48},
                            },
                        },
                        "visualStrategy": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["supportingVisualMode", "logoUsage", "illustrationUsage", "assetDensity"],
                            "properties": {
                                "supportingVisualMode": {"type": "string", "enum": ["logo", "illustration", "auto"]},
                                "logoUsage": {"type": "string", "enum": ["selective", "always", "avoid"]},
                                "illustrationUsage": {"type": "string", "enum": ["selective", "always", "avoid"]},
                                "assetDensity": {"type": "string", "enum": ["minimal", "balanced", "expressive"]},
                            },
                        },
                        "headingRole": {"type": "string", "enum": ["high-impact", "editorial", "clean"]},
                        "bodyRole": {"type": "string", "enum": ["readable", "supporting", "compact"]},
                        "notes": {"type": "string"},
                    },
                },
            }
        },
    }


def layout_response_schema(num_variants: int) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["html_layouts"],
        "properties": {
            "html_layouts": {
                "type": "array",
                "minItems": num_variants,
                "maxItems": num_variants,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["variantIndex", "html"],
                    "properties": {
                        "variantIndex": {"type": "integer", "minimum": 0, "maximum": max(num_variants - 1, 0)},
                        "html": {"type": "string", "minLength": 1},
                    },
                },
            }
        },
    }


def compressed_copy_response_schema(format_constraints: dict[str, int]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["hook", "headline", "body", "cta"],
        "properties": {
            "hook": {"type": "string", "maxLength": format_constraints["hookMaxChars"]},
            "headline": {"type": "string", "maxLength": format_constraints["headlineMaxChars"]},
            "body": {"type": "string", "maxLength": format_constraints["bodyMaxChars"]},
            "cta": {"type": "string", "maxLength": format_constraints["ctaMaxChars"]},
        },
    }


async def compress_input_text_for_format(
    *,
    base_text: str,
    guidelines: NativeGuidelines,
    format_str: str,
    format_constraints: dict[str, int],
) -> str:
    client = create_openai_client()
    model = stage_model("OPENAI_MODEL_SPEC")
    seeded = constrain_input_text_for_format(base_text, format_str).split("\n\n")
    while len(seeded) < 4:
        seeded.append("")
    system_prompt = """You are a conversion copy editor for social ad visuals.
Return strict JSON only and preserve intent while compressing text for visual fit."""
    prompt = f"""Rewrite the input text into concise ad copy for an Instagram {format_str} creative.
Guidelines: {guidelines.model_dump_json()}
Source text:
\"\"\"{base_text}\"\"\"
Initial compressed seed:
hook: {seeded[0]}
headline: {seeded[1]}
body: {seeded[2]}
cta: {seeded[3]}
Constraints:
- hook max {format_constraints['hookMaxChars']} chars
- headline max {format_constraints['headlineMaxChars']} chars
- body max {format_constraints['bodyMaxChars']} chars
- cta max {format_constraints['ctaMaxChars']} chars
- Keep CTA action-oriented and specific.
- Preserve message objective and angle.
Return JSON object:
{{
  "hook": string,
  "headline": string,
  "body": string,
  "cta": string
}}"""
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
            response_format=strict_json_response_format(
                "compressed_copy",
                compressed_copy_response_schema(format_constraints),
            ),
            temperature=0.2,
        )
    except (APIError, APITimeoutError, APIConnectionError, RateLimitError) as exc:
        raise map_openai_error("copy_compression", exc) from exc

    raw = response.choices[0].message.content or "{}"
    parsed = parse_model_json_object(raw, stage="copy_compression")
    hook = truncate_for_layout(str(parsed.get("hook", seeded[0])), format_constraints["hookMaxChars"])
    headline = truncate_for_layout(str(parsed.get("headline", seeded[1] or seeded[0])), format_constraints["headlineMaxChars"])
    body = truncate_for_layout(str(parsed.get("body", seeded[2] or seeded[1] or seeded[0])), format_constraints["bodyMaxChars"])
    cta_seed = str(parsed.get("cta", seeded[3] or "Get started today"))
    cta = truncate_for_layout(cta_seed, format_constraints["ctaMaxChars"])
    return "\n\n".join([hook, headline, body, cta]).strip()


async def generate_design_specs(
    *,
    base_text: str,
    guidelines: Any,
    brand_kit: Any,
    format_str: str,
    variant_blueprints: list[dict[str, Any]],
    format_constraints: dict[str, int],
) -> list[dict[str, Any]]:
    client = create_openai_client()
    model = stage_model("OPENAI_MODEL_SPEC")
    variant_count = len(variant_blueprints)
    system_prompt = """You are a strict JSON planner for visual ad design.
Return valid JSON only.
Do not emit markdown fences.
Do not emit any text outside JSON.
Respect schema and enum constraints exactly."""
    prompt = f"""Create structured design specifications for {variant_count} Instagram {format_str} ad variants.
Brand Kit: {brand_kit.model_dump_json()}
Guidelines: {guidelines.model_dump_json()}
Text: "{base_text}"
Variant blueprints (follow index order exactly): {json.dumps(variant_blueprints, ensure_ascii=False)}
Text constraints: {json.dumps(format_constraints, ensure_ascii=False)}
Return strict JSON object:
{{
  "design_specs": [
    {{
      "variantIndex": number,
      "layoutTemplate": string,
      "surfaceStyle": "glass" | "solid" | "gradient" | "outlined",
      "textAlign": "left" | "center",
      "hierarchy": {{
        "headlinePriority": "dominant" | "high" | "balanced",
        "bodyPriority": "supporting" | "balanced" | "compact",
        "ctaPriority": "high" | "medium"
      }},
      "spacingScale": "compact" | "comfortable" | "airy",
      "cta": {{
        "placement": "bottom" | "inline" | "footer",
        "emphasis": "high" | "medium",
        "style": "solid" | "outline" | "pill"
      }},
      "textPolicy": {{
        "maxHeadlineLines": number,
        "maxBodyLines": number,
        "headlineMaxChars": number,
        "bodyMaxChars": number,
        "ctaMaxChars": number
      }},
      "visualStrategy": {{
        "supportingVisualMode": "logo" | "illustration" | "auto",
        "logoUsage": "selective" | "always" | "avoid",
        "illustrationUsage": "selective" | "always" | "avoid",
        "assetDensity": "minimal" | "balanced" | "expressive"
      }},
      "headingRole": "high-impact" | "editorial" | "clean",
      "bodyRole": "readable" | "supporting" | "compact",
      "notes": string
    }}
  ]
}}
Rules:
- Exactly {variant_count} specs.
- `variantIndex` must be unique and cover all indexes 0..{variant_count - 1}.
- Each spec must be distinct in composition.
- Preserve readability and CTA prominence.
- Use supporting visuals selectively (logo and/or illustration).
- No markdown fences."""
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
            response_format=strict_json_response_format(
                "design_specs",
                design_specs_response_schema(variant_count),
            ),
            temperature=0.4,
        )
    except (APIError, APITimeoutError, APIConnectionError, RateLimitError) as exc:
        raise map_openai_error("design_spec_generation", exc) from exc
    raw = response.choices[0].message.content or "{}"
    parsed = parse_model_json_object(raw, stage="design_spec_generation")
    raw_specs = parsed.get("design_specs")
    if not isinstance(raw_specs, list) or not raw_specs:
        raise HTTPException(status_code=502, detail="Invalid design specs response from model.")
    return order_design_specs(
        raw_specs,
        variant_blueprints=variant_blueprints,
        format_constraints=format_constraints,
    )


def build_public_asset_url(file_path: str) -> str:
    base_url = os.getenv("DELIVERY_BASE_URL", "http://localhost:4100").rstrip("/")
    return f"{base_url}/output/{Path(file_path).name}"


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
    visual_blueprint: dict[str, Any] | None = None,
    design_spec: dict[str, Any] | None = None,
    render_validation: dict[str, Any] | None = None,
    procedural_background: dict[str, Any] | None = None,
) -> dict[str, Any]:
    width, height = infer_platform_dimensions(platform)
    overall = clamp(to_float(score_data.get("score"), 7.0), 0.0, 10.0)
    label = f"Variant {variant_index + 1}"
    variant_id = str(uuid.uuid4())
    blueprint = visual_blueprint or {}
    resolved_design_spec = design_spec or {}
    render_checks = render_validation or {}
    align = str(blueprint.get("textAlign", "left"))
    cta_style = str(blueprint.get("ctaStyle", "solid"))
    assets_ok = bool(render_checks.get("visual_assets", {}).get("valid"))
    cta_ok = bool(render_checks.get("cta", {}).get("valid"))
    judge_subscores = score_data.get("subscores", {}) if isinstance(score_data.get("subscores"), dict) else {}
    judge_defects = score_data.get("defects", []) if isinstance(score_data.get("defects"), list) else []
    judge_repair_hints = score_data.get("repair_hints", []) if isinstance(score_data.get("repair_hints"), list) else []
    judge_confidence = clamp(to_float(score_data.get("confidence"), 0.65), 0.0, 1.0)
    score_penalty = 0.0
    if not cta_ok:
        score_penalty += 1.0
    if not assets_ok:
        score_penalty += 0.4
    adjusted_overall = clamp(overall - score_penalty, 0.0, 10.0)

    visual_assets = {
        "lucideIcon": blueprint.get("lucideIcon", {}),
        "unDrawIllustration": blueprint.get("unDrawIllustration", {}),
        "assetDensity": blueprint.get("assetDensity", "balanced"),
    }
    typography = blueprint.get(
        "typographyPreset",
        {
            "name": "brand-kit-fallback",
            "source": "brandKit",
            "headingFont": brand_kit.headingFont,
            "bodyFont": brand_kit.bodyFont,
            "headlineWeight": 760,
            "bodyWeight": 460,
            "headlineVariationSettings": "",
            "bodyVariationSettings": "",
            "fontOpticalSizing": "auto",
        },
    )
    background = {
        "gradientStart": brand_kit.primaryColor,
        "gradientEnd": brand_kit.secondaryColor,
        "overlayOpacity": 0.22 + (variant_index * 0.03),
        "highlightColor": brand_kit.accentColor,
        "moodSummary": score_data.get("critique", "Balanced hierarchy with clear CTA."),
    }
    if procedural_background:
        seed_value = procedural_background.get("seed", 0)
        try:
            resolved_seed = int(seed_value)
        except (TypeError, ValueError):
            resolved_seed = 0
        background["source"] = str(procedural_background.get("source", "procedural_svg"))
        background["seed"] = resolved_seed
        background["noiseScale"] = to_float(procedural_background.get("noiseScale"), 0.0)
        background["octaves"] = int(to_float(procedural_background.get("octaves"), 1))
        background["textureOpacity"] = clamp(
            to_float(procedural_background.get("textureOpacity"), 0.3),
            0.0,
            1.0,
        )
        background["proceduralSvgDataUri"] = str(procedural_background.get("svgDataUri", ""))
    decorative_layers = (
        procedural_background.get("decorativeLayers", [])
        if isinstance(procedural_background, dict)
        else []
    )
    layout = {
        "textAlign": align,
        "layoutStyle": blueprint.get("layoutStyle", "split-horizontal"),
        "headlineSize": 84 if platform == "instagram_feed_1x1" else 88,
        "bodySize": 34,
        "typographyPresetName": typography.get("name", "brand-kit-fallback"),
        "headingFont": typography.get("headingFont", brand_kit.headingFont),
        "bodyFont": typography.get("bodyFont", brand_kit.bodyFont),
        "headlineWeight": typography.get("headlineWeight", 760),
        "bodyWeight": typography.get("bodyWeight", 460),
        "ctaSize": 36,
        "padding": 72 if platform == "instagram_feed_1x1" else 82,
        "lineClampHeadline": 3,
        "lineClampBody": 4,
        "ctaStyle": cta_style,
        "surfaceStyle": blueprint.get("surfaceStyle", "solid"),
        "contentWidthRatio": 0.84 if align == "left" else 0.9,
    }
    critic = {
        "contrast": clamp(to_float(judge_subscores.get("readability"), adjusted_overall), 0.0, 10.0),
        "hierarchy": clamp(to_float(judge_subscores.get("visual_hierarchy"), adjusted_overall), 0.0, 10.0),
        "brandConsistency": clamp(to_float(judge_subscores.get("brand_consistency"), adjusted_overall), 0.0, 10.0),
        "textDensity": clamp(
            (
                to_float(judge_subscores.get("readability"), adjusted_overall)
                + to_float(judge_subscores.get("guideline_adherence"), adjusted_overall)
            )
            / 2
            - 0.2,
            0.0,
            10.0,
        ),
        "overall": adjusted_overall,
        "guidelineAdherence": clamp(to_float(judge_subscores.get("guideline_adherence"), adjusted_overall), 0.0, 10.0),
        "ctaProminence": clamp(to_float(judge_subscores.get("cta_prominence"), adjusted_overall), 0.0, 10.0),
        "readability": clamp(to_float(judge_subscores.get("readability"), adjusted_overall), 0.0, 10.0),
        "confidence": judge_confidence,
        "defects": judge_defects,
        "repairHints": judge_repair_hints,
        "rationale": score_data.get("critique", "Strong visual hierarchy and CTA."),
        "risks": score_data.get("weaknesses", []),
    }
    judge_insights = {
        "subscores": judge_subscores,
        "defects": judge_defects,
        "repairHints": judge_repair_hints,
        "confidence": judge_confidence,
        "strengths": score_data.get("strengths", []),
        "weaknesses": score_data.get("weaknesses", []),
        "critique": score_data.get("critique", ""),
    }
    asset_url = build_public_asset_url(file_path)
    return {
        "id": variant_id,
        "provider": "internal",
        "label": label,
        "background": background,
        "layout": layout,
        "designSpec": resolved_design_spec,
        "typography": typography,
        "visualAssets": visual_assets,
        "decorativeLayers": decorative_layers,
        "badges": [],
        "logoPlacement": {
            "enabled": bool(brand_kit.logoUrl),
            "position": "top_left",
            "size": 120,
            "style": "badge",
        },
        "critic": critic,
        "judgeInsights": judge_insights,
        "renderValidation": render_checks,
        "rationale": score_data.get("critique", ""),
        "asset": {
            "filename": Path(file_path).name,
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
            "designSpec": resolved_design_spec,
            "typography": typography,
            "visualAssets": visual_assets,
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
            "decorativeLayers": decorative_layers,
            "badges": [],
            "logoPlacement": {
                "enabled": bool(brand_kit.logoUrl),
                "position": "top_left",
                "size": 120,
                "style": "badge",
            },
            "renderValidation": render_checks,
            "critic": critic,
            "judgeInsights": judge_insights,
            "variantMeta": {
                "id": variant_id,
                "provider": "internal",
                "label": label,
                "rationale": score_data.get("critique", ""),
            },
        },
    }


def order_html_layouts(html_layouts: list[Any], *, num_variants: int) -> list[str]:
    indexed_layouts: dict[int, str] = {}
    legacy_layouts: list[str] = []
    for item in html_layouts:
        if isinstance(item, str):
            text = item.strip()
            if text:
                legacy_layouts.append(text)
            continue
        if not isinstance(item, dict):
            continue
        html = item.get("html")
        variant_index_raw = item.get("variantIndex")
        if not isinstance(html, str) or not html.strip():
            continue
        try:
            variant_index = int(variant_index_raw)
        except (TypeError, ValueError):
            continue
        if 0 <= variant_index < num_variants and variant_index not in indexed_layouts:
            indexed_layouts[variant_index] = html.strip()

    ordered_layouts: list[str] = []
    legacy_cursor = 0
    for index in range(num_variants):
        layout = indexed_layouts.get(index)
        if not layout and legacy_cursor < len(legacy_layouts):
            layout = legacy_layouts[legacy_cursor]
            legacy_cursor += 1
        if layout:
            ordered_layouts.append(layout)
    return ordered_layouts


async def generate_html_layouts(
    *,
    base_text: str,
    guidelines: NativeGuidelines,
    brand_kit: NativeBrandKit,
    format_str: str,
    num_variants: int,
    format_constraints: dict[str, int],
    variant_blueprints: list[dict[str, Any]],
    design_specs: list[dict[str, Any]],
    repair_brief: dict[int, dict[str, Any]] | None = None,
) -> list[str]:
    client = create_openai_client()
    model = stage_model("OPENAI_MODEL_LAYOUT")
    system_prompt = """You are a strict JSON generator for HTML/CSS layout production.
Return valid JSON only.
Do not emit markdown fences.
Do not emit any text outside JSON.
Never include <script>, <iframe>, or inline event handlers."""
    repair_context = json.dumps(repair_brief or {}, ensure_ascii=False)
    prompt = f"""Generate {num_variants} production-ready HTML/CSS layouts for an Instagram {format_str} image.
Brand Kit: {brand_kit.model_dump_json()}
Guidelines: {guidelines.model_dump_json()}
Text: "{base_text}"
Variant blueprints (follow index order exactly): {json.dumps(variant_blueprints, ensure_ascii=False)}
Design specs (follow index order exactly): {json.dumps(design_specs, ensure_ascii=False)}
Targeted repair brief by variant index (must address where present): {repair_context}
Requirements:
- Return only JSON object with key "html_layouts" containing exactly {num_variants} items.
- `html_layouts` item schema:
  {{
    "variantIndex": number,    // unique index 0..{num_variants - 1}
    "html": string             // self-contained HTML fragment for <body>
  }}
- Each layout must be self-contained HTML fragment suitable for embedding in <body>.
- Each layout must implement its paired `design_spec` for hierarchy, spacing, CTA placement, and visual strategy.
- CTA must be visually dominant and use provided text intent.
- Use provided colors and fonts.
- Apply each variant `typographyPreset` from the blueprint exactly (font family, weights, and axis settings).
- When `typographyPreset.source` is `variableCatalog`, use `font-optical-sizing:auto` and apply provided `font-variation-settings`.
- Keep body text readable: prefer body weights roughly in the 420-560 range.
- If `typographyPreset.source` is `brandKit`, preserve those font families and do not replace with catalog fonts.
- For each variant, include one Lucide icon using the blueprint URL, for example:
  <img data-lucide-icon="<icon-name>" src="<lucide-url>" alt="<icon-name> icon" ...>
- Add the brand logo only when it improves clarity and there is enough visual space.
- Do not overuse logos: use them selectively across the set, not in every variant.
- If `brand_kit.logo_url` is available and you include it, use:
  <img data-brand-logo="true" src="<brand-logo-url>" alt="brand logo" ...>
- Add an unDraw illustration only when it improves clarity and there is enough visual space.
- Do not overuse illustrations: use them selectively across the set, not in every variant.
- When used, include at most one unDraw illustration per variant using the blueprint URL, for example:
  <img data-undraw-illustration="<illustration-name>" src="<undraw-url>" alt="<illustration-name> illustration" ...>
- No need to include both logo and illustration in the same variant.
- Each variant must include at least one supporting visual: a visible brand logo or a visible unDraw illustration.
- For minimal-density variants, prefer logo-only when `brand_kit.logo_url` exists; otherwise use one small illustration.
- Do not invent other logo URLs; use only `brand_kit.logo_url` when rendering a logo.
- Do not invent other icon/illustration URLs outside the provided blueprints.
- Do not import external CSS libraries or scripts. No `<script>` tags.
- Avoid full-canvas custom background images/gradients that compete with the injected procedural texture.
- Keep container backgrounds transparent or subtle overlays unless design spec explicitly needs a surface panel.
- Enforce these hard text limits for {format_str}: hook <= {format_constraints['hookMaxChars']} chars, headline <= {format_constraints['headlineMaxChars']} chars, body <= {format_constraints['bodyMaxChars']} chars, cta <= {format_constraints['ctaMaxChars']} chars.
- Keep all text fully visible in-canvas; never allow overflow outside the {format_str} viewport.
- Headline must use max {format_constraints['maxHeadlineLines']} lines and body max {format_constraints['maxBodyLines']} lines (truncate/summarize if needed).
- Use CSS overflow controls (line-clamp/ellipsis/wrapping) to guarantee fit.
- Make the illustration supportive (typically 15-35% of canvas area), never overpowering CTA/headline.
- Avoid abrupt font-mix clashes; use at most one heading family and one body family per variant.
- Before finalizing each variant, self-check:
  1) one Lucide icon present
  2) at least one supporting visual (logo or illustration)
  3) CTA visible and prominent
  4) text limits and line clamps respected
- If constraints conflict, prioritize in this order:
  (A) text fit/readability, (B) CTA visibility, (C) visual flourish.
- No markdown fences."""
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt}],
            response_format=strict_json_response_format(
                "html_layouts",
                layout_response_schema(num_variants),
            ),
            temperature=0.5,
        )
    except (APIError, APITimeoutError, APIConnectionError, RateLimitError) as exc:
        raise map_openai_error("html_layout_generation", exc) from exc
    raw = response.choices[0].message.content or "{}"
    parsed = parse_model_json_object(raw, stage="html_layout_generation")
    html_layouts = parsed.get("html_layouts")
    if not isinstance(html_layouts, list) or not html_layouts:
        raise HTTPException(status_code=502, detail="Invalid HTML layouts response from model.")
    ordered_layouts = order_html_layouts(html_layouts, num_variants=num_variants)

    if not ordered_layouts:
        raise HTTPException(status_code=502, detail="Model returned empty HTML layouts.")
    if len(ordered_layouts) < num_variants:
        raise HTTPException(
            status_code=502,
            detail=f"Model returned {len(ordered_layouts)} layouts; expected {num_variants}.",
        )
    return ordered_layouts[:num_variants]


def validation_problem_tags(render_validation: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    if not bool(render_validation.get("cta", {}).get("valid")):
        problems.append("cta_invalid")
    if not bool(render_validation.get("visual_assets", {}).get("valid")):
        problems.append("supporting_visual_missing")
    if not bool(render_validation.get("text_overflow", {}).get("valid", True)):
        problems.append("text_overflow")
    if not bool(render_validation.get("safe_zone", {}).get("valid", True)):
        problems.append("safe_zone_violation")
    if not bool(render_validation.get("contrast", {}).get("valid", True)):
        problems.append("low_contrast")
    return problems


def build_variant_repair_brief(
    scores: list[dict[str, Any]],
    validations: list[dict[str, Any]],
) -> dict[int, dict[str, Any]]:
    brief: dict[int, dict[str, Any]] = {}
    for index, score in enumerate(scores):
        render_validation = validations[index] if index < len(validations) else {}
        defects = score.get("defects", []) if isinstance(score.get("defects"), list) else []
        weaknesses = score.get("weaknesses", []) if isinstance(score.get("weaknesses"), list) else []
        repair_hints = score.get("repair_hints", []) if isinstance(score.get("repair_hints"), list) else []
        problem_tags = validation_problem_tags(render_validation)
        overall = clamp(to_float(score.get("score"), 0.0), 0.0, 10.0)
        high_severity = any(
            isinstance(defect, dict) and str(defect.get("severity", "")).lower() == "high" for defect in defects
        )
        if overall >= QUALITY_BASELINE_THRESHOLDS["mean_overall_score_min"] and not problem_tags and not high_severity:
            continue
        brief[index] = {
            "overall": overall,
            "validationProblems": problem_tags,
            "defects": defects[:4],
            "weaknesses": weaknesses[:4],
            "repairHints": repair_hints[:4],
        }
    return brief


def apply_repair_directives_to_design_specs(
    *,
    design_specs: list[dict[str, Any]],
    repair_brief: dict[int, dict[str, Any]],
    format_constraints: dict[str, int],
) -> list[dict[str, Any]]:
    patched_specs = copy.deepcopy(design_specs)
    for index, directives in repair_brief.items():
        if not (0 <= index < len(patched_specs)):
            continue
        spec = patched_specs[index]
        text_policy = spec.setdefault("textPolicy", {})
        cta = spec.setdefault("cta", {})
        hierarchy = spec.setdefault("hierarchy", {})
        visual_strategy = spec.setdefault("visualStrategy", {})
        notes: list[str] = [str(spec.get("notes", "")).strip()]
        problem_tags = directives.get("validationProblems", [])
        defect_tags = {
            str(defect.get("tag", "")).strip().lower()
            for defect in directives.get("defects", [])
            if isinstance(defect, dict)
        }

        if "cta_invalid" in problem_tags or "cta_not_prominent" in defect_tags:
            cta["placement"] = "bottom"
            cta["emphasis"] = "high"
            cta["style"] = "solid"
            hierarchy["ctaPriority"] = "high"
            notes.append("Repair: strengthen CTA prominence and size.")

        if "text_overflow" in problem_tags or "text_overflow" in defect_tags or "text_density_high" in defect_tags:
            text_policy["maxHeadlineLines"] = max(1, min(int(text_policy.get("maxHeadlineLines", 2)), 2))
            text_policy["maxBodyLines"] = max(2, min(int(text_policy.get("maxBodyLines", 3)), 3))
            text_policy["headlineMaxChars"] = min(
                int(text_policy.get("headlineMaxChars", format_constraints["headlineMaxChars"])),
                format_constraints["headlineMaxChars"],
            )
            text_policy["bodyMaxChars"] = min(
                int(text_policy.get("bodyMaxChars", format_constraints["bodyMaxChars"])),
                format_constraints["bodyMaxChars"],
            )
            text_policy["ctaMaxChars"] = min(
                int(text_policy.get("ctaMaxChars", format_constraints["ctaMaxChars"])),
                format_constraints["ctaMaxChars"],
            )
            notes.append("Repair: reduce text density and enforce tighter line limits.")

        if "low_contrast" in problem_tags or "readability_issue" in defect_tags:
            spec["surfaceStyle"] = "solid"
            visual_strategy["assetDensity"] = "minimal"
            notes.append("Repair: increase contrast and simplify busy overlays.")

        if "supporting_visual_missing" in problem_tags:
            visual_strategy["supportingVisualMode"] = "auto"
            visual_strategy["logoUsage"] = "always"
            notes.append("Repair: ensure visible supporting visual.")

        if "safe_zone_violation" in problem_tags or "poor_alignment" in defect_tags:
            spec["spacingScale"] = "compact"
            spec["textAlign"] = "left"
            notes.append("Repair: keep key elements inside safe zone with stronger alignment.")

        if "visual_clutter" in defect_tags:
            visual_strategy["assetDensity"] = "minimal"
            notes.append("Repair: reduce decorative clutter.")

        spec["notes"] = " ".join(item for item in notes if item).strip()
    return patched_specs


def variant_selection_score(variant: GeneratedVariant) -> float:
    critic = variant.critic if isinstance(variant.critic, dict) else {}
    render_validation = variant.renderValidation if isinstance(variant.renderValidation, dict) else {}
    defects = critic.get("defects", []) if isinstance(critic.get("defects"), list) else []

    weighted = (
        0.42 * clamp(to_float(critic.get("overall"), 0.0), 0.0, 10.0)
        + 0.2 * clamp(to_float(critic.get("ctaProminence"), 0.0), 0.0, 10.0)
        + 0.16 * clamp(to_float(critic.get("readability"), 0.0), 0.0, 10.0)
        + 0.12 * clamp(to_float(critic.get("brandConsistency"), 0.0), 0.0, 10.0)
        + 0.1 * clamp(to_float(critic.get("guidelineAdherence"), 0.0), 0.0, 10.0)
    )
    confidence_boost = 0.3 * clamp(to_float(critic.get("confidence"), 0.0), 0.0, 1.0)
    penalties = 0.0
    if not bool(render_validation.get("cta", {}).get("valid")):
        penalties += 1.8
    if not bool(render_validation.get("visual_assets", {}).get("valid")):
        penalties += 1.0
    if not bool(render_validation.get("text_overflow", {}).get("valid", True)):
        penalties += 1.2
    if not bool(render_validation.get("safe_zone", {}).get("valid", True)):
        penalties += 0.8
    if not bool(render_validation.get("contrast", {}).get("valid", True)):
        penalties += 1.1
    severity_penalty = {"high": 0.45, "medium": 0.2, "low": 0.08}
    for defect in defects:
        if not isinstance(defect, dict):
            continue
        severity = str(defect.get("severity", "medium")).lower()
        penalties += severity_penalty.get(severity, 0.2)
    return round(weighted + confidence_boost - penalties, 4)


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


def public_job_payload(job: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in job.items() if key not in INTERNAL_JOB_KEYS}


def build_generated_variants(
    *,
    rendered: dict[str, Any],
    scores: list[dict[str, Any]],
    variant_blueprints: list[dict[str, Any]],
    design_specs: list[dict[str, Any]],
    procedural_backgrounds: list[dict[str, Any]],
    brand_kit: BrandKitOverride,
    content: dict[str, Any],
    platform: str,
) -> list[GeneratedVariant]:
    generated_variants: list[GeneratedVariant] = []
    for index, file_path in enumerate(rendered["paths"]):
        score = scores[index] if index < len(scores) else {"score": 7.0, "critique": "Scored by fallback."}
        visual_blueprint = variant_blueprints[index] if index < len(variant_blueprints) else {}
        design_spec = design_specs[index] if index < len(design_specs) else {}
        render_validation = rendered["validations"][index] if index < len(rendered["validations"]) else {}
        procedural_background = procedural_backgrounds[index] if index < len(procedural_backgrounds) else None
        variant = enrich_variant(
            variant_index=index,
            file_path=file_path,
            score_data=score,
            brand_kit=brand_kit,
            content=content,
            platform=platform,
            visual_blueprint=visual_blueprint,
            design_spec=design_spec,
            render_validation=render_validation,
            procedural_background=procedural_background,
        )
        generated_variants.append(GeneratedVariant.model_validate(variant))
    return generated_variants


def build_input_payload(
    *,
    payload: CompatGenerateRequest,
    post_id: str,
    brand_kit: BrandKitOverride,
) -> dict[str, Any]:
    input_payload = payload.model_dump()
    input_payload["postId"] = post_id
    if input_payload.get("brandKit") is None:
        input_payload["brandKit"] = brand_kit.model_dump()
    return input_payload


def build_job_record(
    *,
    post_id: str,
    input_payload: dict[str, Any],
    content: dict[str, Any],
    variants: list[GeneratedVariant],
    selected_variant: GeneratedVariant,
    recommended_variant: GeneratedVariant,
    quality_snapshot: dict[str, Any],
    provider_warnings: list[str],
    revision_of_job_id: str | None,
    revision_request: dict[str, Any] | None,
    now: str,
) -> dict[str, Any]:
    stored_variants: list[StoredVariant] = [
        StoredVariant.model_validate(
            {
                "id": variant.id,
                "provider": variant.provider,
                "label": variant.label,
                "background": variant.background,
                "layout": variant.layout,
                "decorativeLayers": variant.decorativeLayers,
                "badges": variant.badges,
                "logoPlacement": variant.logoPlacement,
                "designSpec": variant.designSpec,
                "critic": variant.critic,
                "rationale": variant.rationale,
            }
        )
        for variant in variants
    ]
    variant_assets: dict[str, VariantAsset] = {variant.id: variant.asset for variant in variants}
    variant_component_specs = {variant.id: variant.componentSpec for variant in variants}
    job = StoredJob(
        id=str(uuid.uuid4()),
        threadId=str(uuid.uuid4()),
        status="pending_approval",
        input=input_payload,
        content=content,
        background=selected_variant.background,
        layout=selected_variant.layout,
        componentSpec=selected_variant.componentSpec,
        variants=stored_variants,
        recommendedVariantId=recommended_variant.id,
        selectedVariantId=selected_variant.id,
        qualitySnapshot=quality_snapshot,
        providerWarnings=provider_warnings,
        asset=selected_variant.asset,
        approval=None,
        revisionOfJobId=revision_of_job_id,
        revisionRequest=revision_request,
        createdAt=now,
        updatedAt=now,
        postId=post_id,
        variantAssets=variant_assets,
        variantComponentSpecs=variant_component_specs,
    )
    return job.model_dump()


async def create_job_from_compat_request(
    *,
    post_id: str,
    payload: CompatGenerateRequest,
    store: JsonStateStore,
    revision_of_job_id: str | None = None,
    revision_request: dict[str, Any] | None = None,
) -> dict[str, Any]:
    brand_kit = payload.brandKit or BrandKitOverride()
    provider_preferences = payload.providerPreferences
    provider_warnings: list[str] = []
    if provider_preferences and provider_preferences.preferredProviders is not None:
        if "internal" not in provider_preferences.preferredProviders:
            raise HTTPException(status_code=400, detail="Only internal provider is currently supported.")
    if provider_preferences and provider_preferences.mode == "external_preferred":
        provider_warnings.append("External providers are not configured; falling back to internal provider.")
    format_str = format_from_platform(payload.platform)
    format_constraints = text_constraints_for_format(format_str)
    variant_count = resolve_variant_count(payload.variantCount)
    guidelines_dict = parse_guidelines(payload.designGuidelines)
    native_guidelines = NativeGuidelines(**guidelines_dict)
    constrained_input_text = await compress_input_text_for_format(
        base_text=payload.inputText,
        guidelines=native_guidelines,
        format_str=format_str,
        format_constraints=format_constraints,
    )
    native_brand_kit = to_native_brand_kit(brand_kit)
    semantic_signals = combine_semantic_signals(
        objective=native_guidelines.objective,
        angle=native_guidelines.angle,
        audience=native_guidelines.audience,
        tone=native_guidelines.tone,
        keyword_signals=extract_keywords(constrained_input_text, limit=10),
    )
    lock_brand_fonts = has_explicit_font_overrides(payload.brandKit)
    variant_blueprints = build_variant_blueprints(
        payload.platform,
        variant_count,
        brand_kit=brand_kit,
        lock_brand_fonts=lock_brand_fonts,
        semantic_signals=semantic_signals,
    )
    design_specs = await generate_design_specs(
        base_text=constrained_input_text,
        guidelines=native_guidelines,
        brand_kit=native_brand_kit,
        format_str=format_str,
        variant_blueprints=variant_blueprints,
        format_constraints=format_constraints,
    )
    width, height = infer_platform_dimensions(payload.platform)
    procedural_backgrounds = [
        generate_procedural_background(
            width=width,
            height=height,
            primary_color=brand_kit.primaryColor,
            secondary_color=brand_kit.secondaryColor,
            accent_color=brand_kit.accentColor,
            seed=build_procedural_seed(
                post_id=post_id,
                variant_index=index,
                revision_of_job_id=revision_of_job_id,
            ),
            density=str(blueprint.get("assetDensity", "balanced")),
        )
        for index, blueprint in enumerate(variant_blueprints)
    ]
    emit_quality_log(
        "generation_input",
        {
            "postId": post_id,
            "platform": payload.platform,
            "format": format_str,
            "variantCount": variant_count,
            "hasBrandLogo": bool(brand_kit.logoUrl),
            "fontMode": "brandKit" if lock_brand_fonts else "variableCatalog",
            "guidelines": {
                "objective": native_guidelines.objective,
                "angle": native_guidelines.angle,
                "audience": native_guidelines.audience,
                "tone": native_guidelines.tone,
            },
            "semanticSignals": semantic_signals,
            "designSpecCount": len(design_specs),
            "proceduralBackgrounds": [
                {
                    "variant": index,
                    "seed": background.get("seed"),
                    "noiseScale": background.get("noiseScale"),
                }
                for index, background in enumerate(procedural_backgrounds)
            ],
            "thresholds": QUALITY_BASELINE_THRESHOLDS,
        },
    )
    emit_quality_log(
        "design_spec_output",
        {
            "postId": post_id,
            "platform": payload.platform,
            "variantCount": variant_count,
            "designSpecs": design_specs,
        },
    )
    active_design_specs = design_specs
    active_repair_brief: dict[int, dict[str, Any]] | None = None
    repair_iteration = 0
    max_repair_iterations = repair_max_passes()
    rendered: dict[str, Any] = {"paths": [], "validations": []}
    scores: list[dict[str, Any]] = []
    quality_snapshot: dict[str, Any] = {}
    while True:
        html_layouts = await generate_html_layouts(
            base_text=constrained_input_text,
            guidelines=native_guidelines,
            brand_kit=native_brand_kit,
            format_str=format_str,
            num_variants=variant_count,
            format_constraints=format_constraints,
            variant_blueprints=variant_blueprints,
            design_specs=active_design_specs,
            repair_brief=active_repair_brief,
        )
        rendered = await render_and_validate(
            html_layouts,
            native_brand_kit,
            format_str,
            procedural_backgrounds=procedural_backgrounds,
        )
        try:
            scores = await auto_judge_variants(
                rendered["paths"],
                native_guidelines.model_dump(),
                native_brand_kit.model_dump(),
            )
        except (APIError, APITimeoutError, APIConnectionError, RateLimitError) as exc:
            raise map_openai_error("variant_judging", exc) from exc
        except ValueError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        quality_snapshot = compute_quality_snapshot(
            scores=scores,
            validations=rendered["validations"],
            platform=payload.platform,
            variant_count=variant_count,
        )
        active_repair_brief = build_variant_repair_brief(scores, rendered["validations"])
        quality_needs_attention = quality_snapshot.get("status") != "pass"
        if (not quality_needs_attention and not active_repair_brief) or repair_iteration >= max_repair_iterations:
            break
        active_design_specs = apply_repair_directives_to_design_specs(
            design_specs=active_design_specs,
            repair_brief=active_repair_brief,
            format_constraints=format_constraints,
        )
        repair_iteration += 1

    design_specs = active_design_specs
    content = infer_content(constrained_input_text, payload.designGuidelines)
    variants = build_generated_variants(
        rendered=rendered,
        scores=scores,
        variant_blueprints=variant_blueprints,
        design_specs=design_specs,
        procedural_backgrounds=procedural_backgrounds,
        brand_kit=brand_kit,
        content=content,
        platform=payload.platform,
    )
    for variant in variants:
        variant.critic["selectionScore"] = variant_selection_score(variant)
    emit_quality_log(
        "generation_output",
        {
            "postId": post_id,
            "platform": payload.platform,
            "variantCount": variant_count,
            "judge": [
                {
                    "variant": index,
                    "score": to_float(score.get("score"), 0.0),
                    "weaknessCount": len(score.get("weaknesses", [])) if isinstance(score.get("weaknesses"), list) else 0,
                    "defectCount": len(score.get("defects", [])) if isinstance(score.get("defects"), list) else 0,
                    "confidence": to_float(score.get("confidence"), 0.0),
                }
                for index, score in enumerate(scores)
            ],
            "validation": rendered["validations"],
            "qualitySnapshot": quality_snapshot,
            "repairIterations": repair_iteration,
            "maxRepairIterations": max_repair_iterations,
            "remainingRepairBrief": active_repair_brief or {},
        },
    )

    if not variants:
        raise HTTPException(status_code=500, detail="No variants were generated.")

    recommended_variant = max(variants, key=lambda item: to_float(item.critic.get("selectionScore"), 0.0))
    selected_variant = recommended_variant
    now = utc_now()
    input_payload = build_input_payload(payload=payload, post_id=post_id, brand_kit=brand_kit)
    job = build_job_record(
        post_id=post_id,
        input_payload=input_payload,
        content=content,
        variants=variants,
        selected_variant=selected_variant,
        recommended_variant=recommended_variant,
        quality_snapshot=quality_snapshot,
        provider_warnings=provider_warnings,
        revision_of_job_id=revision_of_job_id,
        revision_request=revision_request,
        now=now,
    )
    store.create_job(post_id, job)
    return job


def get_post_job_or_404(post_id: str, job_id: str, store: JsonStateStore) -> dict[str, Any]:
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
