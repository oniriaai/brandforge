from typing import Any

from pydantic import BaseModel, Field


class VariantAsset(BaseModel):
    filename: str
    relativeUrl: str
    width: int
    height: int


class GeneratedVariant(BaseModel):
    id: str
    provider: str
    label: str
    background: dict[str, Any] = Field(default_factory=dict)
    layout: dict[str, Any] = Field(default_factory=dict)
    designSpec: dict[str, Any] = Field(default_factory=dict)
    typography: dict[str, Any] = Field(default_factory=dict)
    visualAssets: dict[str, Any] = Field(default_factory=dict)
    decorativeLayers: list[dict[str, Any]] = Field(default_factory=list)
    badges: list[Any] = Field(default_factory=list)
    logoPlacement: dict[str, Any] = Field(default_factory=dict)
    critic: dict[str, Any] = Field(default_factory=dict)
    judgeInsights: dict[str, Any] = Field(default_factory=dict)
    renderValidation: dict[str, Any] = Field(default_factory=dict)
    rationale: str = ""
    asset: VariantAsset
    componentSpec: dict[str, Any] = Field(default_factory=dict)


class StoredVariant(BaseModel):
    id: str
    provider: str
    label: str
    background: dict[str, Any] = Field(default_factory=dict)
    layout: dict[str, Any] = Field(default_factory=dict)
    decorativeLayers: list[dict[str, Any]] = Field(default_factory=list)
    badges: list[Any] = Field(default_factory=list)
    logoPlacement: dict[str, Any] = Field(default_factory=dict)
    designSpec: dict[str, Any] = Field(default_factory=dict)
    critic: dict[str, Any] = Field(default_factory=dict)
    rationale: str = ""


class StoredJob(BaseModel):
    id: str
    threadId: str
    status: str
    input: dict[str, Any]
    content: dict[str, Any]
    background: dict[str, Any]
    layout: dict[str, Any]
    componentSpec: dict[str, Any]
    variants: list[StoredVariant]
    recommendedVariantId: str
    selectedVariantId: str
    qualitySnapshot: dict[str, Any]
    providerWarnings: list[str] = Field(default_factory=list)
    asset: VariantAsset
    approval: dict[str, Any] | None = None
    revisionOfJobId: str | None = None
    revisionRequest: dict[str, Any] | None = None
    createdAt: str
    updatedAt: str
    postId: str
    variantAssets: dict[str, VariantAsset]
    variantComponentSpecs: dict[str, dict[str, Any]]


__all__ = [
    "GeneratedVariant",
    "StoredJob",
    "StoredVariant",
    "VariantAsset",
]
