import axios from 'axios';
import type {
  Campaign,
  ContentPost,
  ContentVersion,
  TemplateDefinition,
  BrandConfig,
  GenerateRequest,
  RefineRequest,
  AgentGeneratePayload,
  AgentGenerateResponse,
  AgentSelectVariantPayload,
  AgentComponentSpec,
  AgentImageJob,
  AgentDeliverResponse,
} from '../types';

const api = axios.create({ baseURL: '/api' });

// Campaigns
export const getCampaigns = () =>
  api.get<Campaign[]>('/campaigns').then((r) => r.data);

export const getCampaign = (id: string) =>
  api.get<Campaign>(`/campaigns/${id}`).then((r) => r.data);

export const createCampaign = (data: Partial<Campaign>) =>
  api.post<Campaign>('/campaigns', data).then((r) => r.data);

export const updateCampaign = (id: string, data: Partial<Campaign>) =>
  api.put<Campaign>(`/campaigns/${id}`, data).then((r) => r.data);

export const deleteCampaign = (id: string) =>
  api.delete(`/campaigns/${id}`).then((r) => r.data);

// Content
export const getPostsByCampaign = (campaignId: string) =>
  api.get<ContentPost[]>(`/content?campaignId=${campaignId}`).then((r) => r.data);

export const getPost = (id: string) =>
  api.get<ContentPost>(`/content/${id}`).then((r) => r.data);

export const toggleFavorite = (id: string) =>
  api.put<ContentPost>(`/content/${id}/favorite`).then((r) => r.data);

export const getFavorites = (campaignId: string) =>
  api.get<ContentPost[]>(`/content/favorites?campaignId=${campaignId}`).then((r) => r.data);

export const getVersions = (postId: string) =>
  api.get<ContentVersion[]>(`/content/${postId}/versions`).then((r) => r.data);

export const restoreVersion = (postId: string, versionId: string) =>
  api.post<ContentPost>(`/content/${postId}/versions/${versionId}/restore`).then((r) => r.data);

export const deletePost = (id: string) =>
  api.delete(`/content/${id}`).then((r) => r.data);

// Generation
export const generateContent = (data: GenerateRequest) =>
  api.post<ContentPost[]>('/generation/generate', data).then((r) => r.data);

export const refineContent = (data: RefineRequest) =>
  api.post<ContentPost>('/generation/refine', data).then((r) => r.data);

// Templates
export const getTemplates = (platform?: string) =>
  api.get<TemplateDefinition[]>('/templates', { params: platform ? { platform } : {} }).then((r) => r.data);

// Render
export const renderPost = (postId: string, templateId: string) =>
  api.post<{ imageUrl: string }>('/render', { postId, templateId }).then((r) => r.data);

export const getPreviewHtml = (postId: string, templateId: string) =>
  api.post<{ html: string; width: number; height: number }>('/render/preview', { postId, templateId }).then((r) => r.data);

// Brand Config (global)
export const getBrandConfig = () =>
  api.get<BrandConfig>('/brand-assets/config').then((r) => r.data);

export const updateBrandConfig = (data: Partial<BrandConfig>) =>
  api.put<BrandConfig>('/brand-assets/config', data).then((r) => r.data);

// Brand Assets (file upload)
export const uploadBrandAsset = (type: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);
  return api.post('/brand-assets/upload', form).then((r) => r.data);
};

// AI Image Generator integration (compat endpoint group: /ai-image-agent)
type AgentGenerateOverrides = Pick<
  AgentGeneratePayload,
  'variantCount' | 'providerPreferences'
>;

export const agentGenerateImage = (
  postId: string,
  data: AgentGeneratePayload,
  overrides?: AgentGenerateOverrides,
) =>
  api
    .post<AgentGenerateResponse>(`/ai-image-agent/posts/${postId}/generate`, {
      ...data,
      ...overrides,
    })
    .then((r) => r.data);

export const agentGetJobsByPost = (postId: string) =>
  api.get<AgentImageJob[]>(`/ai-image-agent/posts/${postId}/jobs`).then((r) => r.data);

export const agentGetJob = (postId: string, jobId: string) =>
  api.get<AgentImageJob>(`/ai-image-agent/posts/${postId}/jobs/${jobId}`).then((r) => r.data);

export const agentGetComponentSpec = (postId: string, jobId: string) =>
  api
    .get<AgentComponentSpec>(`/ai-image-agent/posts/${postId}/jobs/${jobId}/component-spec`)
    .then((r) => r.data);

export const agentSuggestChanges = (
  postId: string,
  jobId: string,
  reviewer: string,
  instruction: string,
) =>
  api
    .post<AgentGenerateResponse>(`/ai-image-agent/posts/${postId}/jobs/${jobId}/suggest`, {
      reviewer,
      instruction,
    })
    .then((r) => r.data);

export const agentSelectVariant = (
  postId: string,
  jobId: string,
  data: AgentSelectVariantPayload,
) =>
  api
    .post<AgentImageJob>(`/ai-image-agent/posts/${postId}/jobs/${jobId}/select-variant`, data)
    .then((r) => r.data);

export const agentGetPendingApprovals = (postId: string) =>
  api.get<AgentImageJob[]>(`/ai-image-agent/posts/${postId}/approvals/pending`).then((r) => r.data);

export const agentApprove = (postId: string, jobId: string, reviewer: string) =>
  api.post<AgentImageJob>(`/ai-image-agent/posts/${postId}/approvals/${jobId}/approve`, { reviewer }).then((r) => r.data);

export const agentReject = (postId: string, jobId: string, reviewer: string, reason: string) =>
  api.post<AgentImageJob>(`/ai-image-agent/posts/${postId}/approvals/${jobId}/reject`, { reviewer, reason }).then((r) => r.data);

export const agentDeliver = (postId: string, jobId: string) =>
  api.get<AgentDeliverResponse>(`/ai-image-agent/posts/${postId}/jobs/${jobId}/deliver`).then((r) => r.data);
