export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  objective: 'awareness' | 'lead_generation' | 'conversion' | 'engagement' | 'brand_positioning';
  targetAudience: string | null;
  valueProposition: string | null;
  painPoints: string[] | null;
  brandVoice: string | null;
  industry: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Platform =
  | 'instagram_feed_1x1'
  | 'instagram_feed_4x5'
  | 'instagram_carousel'
  | 'linkedin_post';

export type MarketingAngle =
  | 'educational'
  | 'storytelling'
  | 'direct_sale'
  | 'authority'
  | 'social_proof'
  | 'pain_agitate_solve';

export type PostObjective = 'awareness' | 'lead' | 'conversion' | 'engagement';

export interface ContentPost {
  id: string;
  campaignId: string;
  platform: Platform;
  marketingAngle: MarketingAngle;
  objective: PostObjective;
  targetAudience: string;
  hook: string;
  body: string;
  cta: string;
  caption: string | null;
  headline: string | null;
  subheadline: string | null;
  painPoint: string | null;
  valueProposition: string | null;
  tone: string | null;
  templateId: string | null;
  isFavorite: boolean;
  currentVersion: number;
  renderedImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentVersion {
  id: string;
  postId: string;
  versionNumber: number;
  contentSnapshot: Record<string, unknown>;
  refinementPrompt: string | null;
  renderedImageUrl: string | null;
  createdAt: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  platform: string;
  description: string;
  width: number;
  height: number;
}

export type DesignStyle = 'minimal' | 'bold' | 'corporate' | 'creative' | 'elegant' | 'modern';

export interface BrandConfig {
  id: string;
  name: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  logoAssetId: string | null;
  designStyle: DesignStyle;
}

export interface GenerateRequest {
  campaignId: string;
  platform: Platform;
  objective: PostObjective;
  marketingAngle?: MarketingAngle;
  targetAudience?: string;
  topic?: string;
  additionalContext?: string;
  variants?: number;
}

export interface RefineRequest {
  postId: string;
  instruction: string;
}

export interface AgentBrandKitInput {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  logoUrl?: string;
}

export type AgentPlatform = 'instagram_feed_1x1' | 'instagram_feed_4x5';
export type AgentDesignProvider = 'internal' | 'stitch' | 'twentyfirst' | 'external_subagent';
export type AgentProviderMode = 'auto' | 'internal_only' | 'external_preferred';

export interface AgentProviderPreferences {
  mode?: AgentProviderMode;
  preferredProviders?: AgentDesignProvider[];
}

export interface AgentGeneratePayload {
  inputText: string;
  designGuidelines: string;
  platform: AgentPlatform;
  brandKit?: Partial<AgentBrandKitInput>;
  variantCount?: number;
  providerPreferences?: AgentProviderPreferences;
}

export interface AgentGenerateRequest extends AgentGeneratePayload {
  brandKit: AgentBrandKitInput;
}

export interface AgentSelectVariantPayload {
  variantId: string;
}

export interface AgentJobInput extends AgentGenerateRequest {
  postId: string;
}

export type AgentJobStatus =
  | 'draft_generated'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'delivered';

export interface AgentContentAnalysis {
  hook: string;
  headline: string;
  body: string;
  cta: string;
  tone: string;
  visualIntent: string;
  keywordSignals: string[];
}

export interface AgentBackgroundSelection {
  gradientStart: string;
  gradientEnd: string;
  overlayOpacity: number;
  highlightColor: string;
  moodSummary: string;
  source?: 'gradient' | 'procedural_svg';
  seed?: number;
  noiseScale?: number;
  octaves?: number;
  textureOpacity?: number;
  proceduralSvgDataUri?: string;
}

export interface AgentLayoutGeneration {
  textAlign: 'left' | 'center';
  headlineSize: number;
  bodySize: number;
  ctaSize: number;
  padding: number;
  lineClampHeadline: number;
  lineClampBody: number;
  ctaStyle: 'solid' | 'outline' | 'pill';
  surfaceStyle?: 'none' | 'glass' | 'solid';
  contentWidthRatio?: number;
}

export interface AgentDecorativeLayer {
  kind: 'circle' | 'ring' | 'mesh' | 'beam';
  color: string;
  opacity: number;
  size: number;
  x: number;
  y: number;
}

export interface AgentLogoPlacement {
  enabled: boolean;
  position: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right';
  size: number;
  style: 'plain' | 'badge' | 'pill';
}

export interface AgentStitchStyleHints {
  palette?: string[];
  textAlign?: 'left' | 'center';
  surfaceStyle?: 'none' | 'glass' | 'solid';
  contentWidthRatio?: number;
}

export interface AgentStitchArtifact {
  source: 'stitch';
  screenId: string;
  htmlUrl: string;
  imageUrl?: string;
  styleHints?: AgentStitchStyleHints;
}

export interface AgentDesignCriticScore {
  contrast: number;
  hierarchy: number;
  brandConsistency: number;
  textDensity: number;
  overall: number;
  rationale: string;
  risks: string[];
}

export interface AgentVariantMeta {
  id: string;
  provider: AgentDesignProvider;
  label: string;
  rationale?: string;
}

export interface AgentDesignVariant {
  id: string;
  provider: AgentDesignProvider;
  label: string;
  background: AgentBackgroundSelection;
  layout: AgentLayoutGeneration;
  decorativeLayers: AgentDecorativeLayer[];
  badges: string[];
  logoPlacement?: AgentLogoPlacement;
  stitchArtifact?: AgentStitchArtifact;
  critic?: AgentDesignCriticScore;
  rationale?: string;
}

export interface AgentComponentSpec {
  platform: AgentPlatform;
  width: number;
  height: number;
  content: AgentContentAnalysis;
  background: AgentBackgroundSelection;
  layout: AgentLayoutGeneration;
  brandKit: AgentBrandKitInput;
  decorativeLayers?: AgentDecorativeLayer[];
  badges?: string[];
  logoPlacement?: AgentLogoPlacement;
  stitchArtifact?: AgentStitchArtifact;
  critic?: AgentDesignCriticScore;
  variantMeta?: AgentVariantMeta;
}

export interface AgentRenderedAsset {
  filename: string;
  filePath: string;
  relativeUrl: string;
  width: number;
  height: number;
}

export interface AgentApprovalRecord {
  reviewer: string;
  reviewedAt: string;
  reason?: string;
}

export interface AgentRevisionRequest {
  reviewer: string;
  instruction: string;
  requestedAt: string;
}

export interface AgentImageJob {
  id: string;
  status: AgentJobStatus;
  input: AgentJobInput;
  content?: AgentContentAnalysis;
  background?: AgentBackgroundSelection;
  layout?: AgentLayoutGeneration;
  componentSpec?: AgentComponentSpec;
  variants?: AgentDesignVariant[];
  recommendedVariantId?: string;
  selectedVariantId?: string;
  providerWarnings?: string[];
  asset?: AgentRenderedAsset;
  approval?: AgentApprovalRecord;
  revisionOfJobId?: string;
  revisionRequest?: AgentRevisionRequest;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGenerateResponse {
  jobId: string;
  status: AgentJobStatus;
  previewUrl: string;
  revisionOfJobId?: string;
  recommendedVariantId?: string;
  variants?: Array<{
    id: string;
    provider: AgentDesignProvider;
    label: string;
    overallScore: number;
  }>;
}

export interface AgentDeliverResponse {
  deliveryUrl: string;
  status: AgentJobStatus;
}
