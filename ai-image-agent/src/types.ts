export type Platform = 'instagram_feed_1x1' | 'instagram_feed_4x5';

export type JobStatus =
  | 'draft_generated'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'delivered';

export interface BrandKit {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  logoUrl?: string;
}

export interface GenerateImageRequest {
  inputText: string;
  designGuidelines: string;
  platform: Platform;
  brandKit: BrandKit;
}

export interface ContentAnalysisResult {
  hook: string;
  headline: string;
  body: string;
  cta: string;
  tone: string;
  visualIntent: string;
  keywordSignals: string[];
}

export interface BackgroundSelectionResult {
  gradientStart: string;
  gradientEnd: string;
  overlayOpacity: number;
  highlightColor: string;
  moodSummary: string;
}

export interface LayoutGenerationResult {
  textAlign: 'left' | 'center';
  headlineSize: number;
  bodySize: number;
  ctaSize: number;
  padding: number;
  lineClampHeadline: number;
  lineClampBody: number;
  ctaStyle: 'solid' | 'outline';
}

export interface RenderedAsset {
  filename: string;
  filePath: string;
  relativeUrl: string;
  width: number;
  height: number;
}

export interface ApprovalRecord {
  reviewer: string;
  reviewedAt: string;
  reason?: string;
}

export interface ImageJob {
  id: string;
  status: JobStatus;
  input: GenerateImageRequest;
  content?: ContentAnalysisResult;
  background?: BackgroundSelectionResult;
  layout?: LayoutGenerationResult;
  asset?: RenderedAsset;
  approval?: ApprovalRecord;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateImageResponse {
  jobId: string;
  status: JobStatus;
  previewUrl: string;
}
