from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl


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
