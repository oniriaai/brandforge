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
