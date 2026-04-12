import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import {
  agentApprove,
  agentDeliver,
  agentGenerateImage,
  agentGetJob,
  agentGetJobsByPost,
  agentReject,
  agentSelectVariant,
  agentSuggestChanges,
  getBrandConfig,
  getPost,
} from '../api/client';
import type {
  AgentBrandKitInput,
  AgentGeneratePayload,
  AgentGenerateRequest,
  AgentImageJob,
  ContentPost,
} from '../types';

const DEFAULT_BRAND_KIT: AgentBrandKitInput = {
  primaryColor: '#4F46E5',
  secondaryColor: '#9333EA',
  accentColor: '#F59E0B',
  backgroundColor: '#FFFFFF',
  textColor: '#111827',
  headingFont: 'Inter',
  bodyFont: 'Inter',
};

const isHexColor = (value: string | null | undefined) => /^#([A-Fa-f0-9]{6})$/.test(value || '');

const normalizeColor = (value: string | null | undefined, fallback: string) =>
  isHexColor(value) ? (value as string) : fallback;

const buildBrandKitOverrides = (
  current: AgentBrandKitInput,
  defaults: AgentBrandKitInput,
): Partial<AgentBrandKitInput> => {
  const overrides: Partial<AgentBrandKitInput> = {};
  if (current.primaryColor !== defaults.primaryColor) overrides.primaryColor = current.primaryColor;
  if (current.secondaryColor !== defaults.secondaryColor) {
    overrides.secondaryColor = current.secondaryColor;
  }
  if (current.accentColor !== defaults.accentColor) overrides.accentColor = current.accentColor;
  if (current.backgroundColor !== defaults.backgroundColor) {
    overrides.backgroundColor = current.backgroundColor;
  }
  if (current.textColor !== defaults.textColor) overrides.textColor = current.textColor;
  if (current.headingFont !== defaults.headingFont) overrides.headingFont = current.headingFont;
  if (current.bodyFont !== defaults.bodyFont) overrides.bodyFont = current.bodyFont;
  if (current.logoUrl !== defaults.logoUrl && current.logoUrl) overrides.logoUrl = current.logoUrl;
  return overrides;
};

const extractErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    if (
      response &&
      typeof response.data === 'object' &&
      response.data &&
      'message' in response.data &&
      typeof (response.data as { message?: unknown }).message === 'string'
    ) {
      return (response.data as { message: string }).message;
    }
  }
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
};

const normalizePlatform = (post: ContentPost): AgentGenerateRequest['platform'] =>
  post.platform === 'instagram_feed_4x5' ? 'instagram_feed_4x5' : 'instagram_feed_1x1';

const buildSeedInputText = (post: ContentPost) =>
  [post.hook, post.headline, post.body, post.cta].filter(Boolean).join('\n\n');

const buildSeedGuidelines = (post: ContentPost) =>
  [
    `Objetivo: ${post.objective}.`,
    `Ángulo: ${post.marketingAngle.replace(/_/g, ' ')}.`,
    `Audiencia: ${post.targetAudience}.`,
    `Tono: ${post.tone || 'consistente con marca'}.`,
    'Mantener jerarquía visual clara y CTA muy visible.',
  ].join(' ');

const STATUS_LABEL: Record<AgentImageJob['status'], string> = {
  draft_generated: 'Borrador generado',
  pending_approval: 'Pendiente de aprobación',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  delivered: 'Entregado',
};

const STATUS_BADGE: Record<AgentImageJob['status'], string> = {
  draft_generated: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  delivered: 'bg-blue-100 text-blue-800',
};

const VARIANT_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;

const PROVIDER_LABELS: Record<string, string> = {
  internal: 'Interno',
  stitch: 'Stitch',
  twentyfirst: '21st',
  external_subagent: 'Subagente externo',
};

export default function AiImageAgentPage() {
  const { id: postId } = useParams<{ id: string }>();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [form, setForm] = useState<AgentGenerateRequest>({
    inputText: '',
    designGuidelines: '',
    platform: 'instagram_feed_1x1',
    brandKit: DEFAULT_BRAND_KIT,
    variantCount: 3,
  });
  const [postJobs, setPostJobs] = useState<AgentImageJob[]>([]);
  const [brandKitDefaults, setBrandKitDefaults] = useState<AgentBrandKitInput>(DEFAULT_BRAND_KIT);
  const [hasGlobalLogo, setHasGlobalLogo] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<AgentImageJob | null>(null);
  const [reviewer, setReviewer] = useState('brand-manager');
  const [rejectionReason, setRejectionReason] = useState('');
  const [suggestionInstruction, setSuggestionInstruction] = useState('');
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null);
  const [isPostLoading, setIsPostLoading] = useState(true);
  const [isBrandKitLoading, setIsBrandKitLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [isJobLoading, setIsJobLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSelectingVariant, setIsSelectingVariant] = useState(false);
  const [recommendedVariantByJob, setRecommendedVariantByJob] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selectedImageUrl = useMemo(
    () => deliveryUrl || selectedJob?.asset?.relativeUrl || null,
    [deliveryUrl, selectedJob],
  );

  const recommendedVariantId = useMemo(() => {
    if (!selectedJob) return null;
    if (selectedJob.recommendedVariantId) return selectedJob.recommendedVariantId;
    if (recommendedVariantByJob[selectedJob.id]) return recommendedVariantByJob[selectedJob.id];
    const rankedVariants = [...(selectedJob.variants ?? [])].sort(
      (a, b) => (b.critic?.overall ?? Number.NEGATIVE_INFINITY) - (a.critic?.overall ?? Number.NEGATIVE_INFINITY),
    );
    return rankedVariants[0]?.id ?? null;
  }, [recommendedVariantByJob, selectedJob]);

  const loadPostJobs = async (silent = false) => {
    if (!postId) return;
    if (!silent) setIsQueueLoading(true);
    try {
      const jobs = await agentGetJobsByPost(postId);
      setPostJobs(jobs);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      if (!silent) setIsQueueLoading(false);
    }
  };

  const loadJob = async (jobId: string, silent = false) => {
    if (!postId) return;
    if (!silent) setIsJobLoading(true);
    try {
      const job = await agentGetJob(postId, jobId);
      setSelectedJob(job);
      setDeliveryUrl(job.status === 'delivered' ? job.asset?.relativeUrl ?? null : null);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      if (!silent) setIsJobLoading(false);
    }
  };

  useEffect(() => {
    if (!postId) return;
    const loadPageData = async () => {
      setErrorMessage(null);
      setIsPostLoading(true);
      setIsBrandKitLoading(true);
      try {
        const [postData, config] = await Promise.all([getPost(postId), getBrandConfig()]);
        const globalBrandKit: AgentBrandKitInput = {
          primaryColor: normalizeColor(config.primaryColor, DEFAULT_BRAND_KIT.primaryColor),
          secondaryColor: normalizeColor(config.secondaryColor, DEFAULT_BRAND_KIT.secondaryColor),
          accentColor: normalizeColor(config.accentColor, DEFAULT_BRAND_KIT.accentColor),
          backgroundColor: normalizeColor(config.backgroundColor, DEFAULT_BRAND_KIT.backgroundColor),
          textColor: normalizeColor(config.textColor, DEFAULT_BRAND_KIT.textColor),
          headingFont: config.headingFont?.trim() || DEFAULT_BRAND_KIT.headingFont,
          bodyFont: config.bodyFont?.trim() || DEFAULT_BRAND_KIT.bodyFont,
        };

        setPost(postData);
        setBrandKitDefaults(globalBrandKit);
        setHasGlobalLogo(Boolean(config.logoAssetId));
        setForm({
          inputText: buildSeedInputText(postData),
          designGuidelines: buildSeedGuidelines(postData),
          platform: normalizePlatform(postData),
          brandKit: globalBrandKit,
          variantCount: 3,
        });
      } catch (error) {
        setErrorMessage(extractErrorMessage(error));
      } finally {
        setIsPostLoading(false);
        setIsBrandKitLoading(false);
      }
      await loadPostJobs();
    };
    void loadPageData();
  }, [postId]);

  useEffect(() => {
    if (!selectedJobId) return;
    const timer = window.setInterval(() => {
      void loadJob(selectedJobId, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedJobId, postId]);

  const handleGenerate = async (event: React.FormEvent) => {
    if (!postId) return;
    event.preventDefault();
    setErrorMessage(null);
    setActionMessage(null);
    setIsGenerating(true);
    try {
      const brandKitOverrides = buildBrandKitOverrides(form.brandKit, brandKitDefaults);
      const payload: AgentGeneratePayload = {
        inputText: form.inputText,
        designGuidelines: form.designGuidelines,
        platform: form.platform,
        variantCount: form.variantCount,
        brandKit:
          Object.keys(brandKitOverrides).length > 0 ? brandKitOverrides : undefined,
      };
      const result = await agentGenerateImage(postId, payload);
      setSelectedJobId(result.jobId);
      setDeliveryUrl(null);
      if (result.recommendedVariantId) {
        setRecommendedVariantByJob((current) => ({
          ...current,
          [result.jobId]: result.recommendedVariantId as string,
        }));
      }
      setActionMessage(`Job ${result.jobId} creado con estado ${STATUS_LABEL[result.status]}.`);
      await Promise.all([loadJob(result.jobId), loadPostJobs(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectJob = async (jobId: string) => {
    setSelectedJobId(jobId);
    setDeliveryUrl(null);
    await loadJob(jobId);
  };

  const handleApprove = async () => {
    if (!postId || !selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsApproving(true);
    try {
      const job = await agentApprove(postId, selectedJobId, reviewer);
      setActionMessage(`Job ${job.id} aprobado por ${reviewer}.`);
      await Promise.all([loadJob(selectedJobId, true), loadPostJobs(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!postId || !selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsRejecting(true);
    try {
      const job = await agentReject(postId, selectedJobId, reviewer, rejectionReason);
      setActionMessage(`Job ${job.id} rechazado.`);
      await Promise.all([loadJob(selectedJobId, true), loadPostJobs(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeliver = async () => {
    if (!postId || !selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsDelivering(true);
    try {
      const result = await agentDeliver(postId, selectedJobId);
      setDeliveryUrl(result.deliveryUrl);
      setActionMessage('Imagen entregada correctamente y guardada en el post.');
      await Promise.all([loadJob(selectedJobId, true), loadPostJobs(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsDelivering(false);
    }
  };

  const handleSuggestChanges = async () => {
    if (!postId || !selectedJobId || !suggestionInstruction.trim()) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsSuggesting(true);
    try {
      const result = await agentSuggestChanges(
        postId,
        selectedJobId,
        reviewer,
        suggestionInstruction.trim(),
      );
      setSelectedJobId(result.jobId);
      setDeliveryUrl(null);
      setSuggestionInstruction('');
      if (result.recommendedVariantId) {
        setRecommendedVariantByJob((current) => ({
          ...current,
          [result.jobId]: result.recommendedVariantId as string,
        }));
      }
      setActionMessage(`Revisión creada: ${result.jobId}.`);
      await Promise.all([loadJob(result.jobId), loadPostJobs(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSuggesting(false);
    }
  };

  const resetBrandKitToDefaults = () => {
    setForm((current) => ({
      ...current,
      brandKit: brandKitDefaults,
    }));
    setActionMessage('Brand Kit restablecido a la configuración global.');
  };

  const handleSelectVariant = async (variantId: string, label: string) => {
    if (!postId || !selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsSelectingVariant(true);
    try {
      await agentSelectVariant(postId, selectedJobId, { variantId });
      setDeliveryUrl(null);
      setActionMessage(`Variante "${label}" seleccionada.`);
      await Promise.all([loadJob(selectedJobId), loadPostJobs(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSelectingVariant(false);
    }
  };

  if (!postId) {
    return <div className="text-center py-20 text-gray-500">Post no encontrado.</div>;
  }

  if (isPostLoading) {
    return <div className="text-center py-20 text-gray-500">Cargando post...</div>;
  }

  if (!post) {
    return <div className="text-center py-20 text-gray-500">Post no encontrado.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/posts/${postId}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Image Generator</h1>
            <p className="text-sm text-gray-500">Post {post.id.slice(0, 8)} · flujo actual: generar, revisar, aprobar y entregar</p>
          </div>
        </div>
        <button
          onClick={() => void loadPostJobs()}
          disabled={isQueueLoading}
          className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isQueueLoading ? 'animate-spin' : ''}`} />
          Actualizar historial
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contexto del post</p>
        <p className="text-sm text-gray-700 line-clamp-2">{post.hook}</p>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {errorMessage}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">
          {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImagePlus className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-gray-900">Nueva generación</h2>
          </div>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Texto base</label>
              <textarea
                required
                rows={4}
                value={form.inputText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, inputText: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Describe el mensaje principal del post..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guías de diseño</label>
              <textarea
                required
                rows={3}
                value={form.designGuidelines}
                onChange={(event) =>
                  setForm((current) => ({ ...current, designGuidelines: event.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Define estilo visual, jerarquía y CTA..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
              <select
                value={form.platform}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    platform: event.target.value as AgentGenerateRequest['platform'],
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="instagram_feed_1x1">Instagram Feed 1:1</option>
                <option value="instagram_feed_4x5">Instagram Feed 4:5</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-gray-700">
                Cantidad de variantes
                <select
                  value={form.variantCount ?? 3}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      variantCount: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {VARIANT_COUNT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              El motor actual prioriza render interno con evaluación automática de variantes.
            </div>

            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4 text-gray-500" />
                  <h3 className="font-medium text-gray-800">Brand Kit (global + editable)</h3>
                </div>
                <button
                  type="button"
                  onClick={resetBrandKitToDefaults}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restablecer
                </button>
              </div>
              {isBrandKitLoading ? (
                <p className="text-sm text-gray-500">Cargando configuración de marca...</p>
              ) : (
                <>
                  {hasGlobalLogo && (
                    <p className="text-xs text-gray-500">
                      Logo global detectado. Se aplicará automáticamente al generar la imagen.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-sm text-gray-600">
                      Primario
                      <input
                        type="text"
                        value={form.brandKit.primaryColor}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, primaryColor: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-600">
                      Secundario
                      <input
                        type="text"
                        value={form.brandKit.secondaryColor}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, secondaryColor: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-600">
                      Acento
                      <input
                        type="text"
                        value={form.brandKit.accentColor}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, accentColor: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-600">
                      Fondo
                      <input
                        type="text"
                        value={form.brandKit.backgroundColor}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, backgroundColor: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-600">
                      Texto
                      <input
                        type="text"
                        value={form.brandKit.textColor}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, textColor: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-600">
                      Heading font
                      <input
                        type="text"
                        value={form.brandKit.headingFont}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, headingFont: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                    <label className="text-sm text-gray-600 sm:col-span-2">
                      Body font
                      <input
                        type="text"
                        value={form.brandKit.bodyFont}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            brandKit: { ...current.brandKit, bodyFont: event.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    Usa formato HEX de 6 dígitos (ej: #4F46E5) para evitar errores de validación.
                  </p>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={isGenerating || isBrandKitLoading}
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Generando imagen...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generar imagen
                </>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Jobs del post</h2>
          {isQueueLoading ? (
            <p className="text-sm text-gray-500">Cargando jobs...</p>
          ) : postJobs.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay jobs para este post.</p>
          ) : (
            <div className="space-y-2">
              {postJobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => void handleSelectJob(job.id)}
                  className={`w-full text-left border rounded-lg p-3 transition ${
                    selectedJobId === job.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{job.id}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[job.status]}`}>
                      {STATUS_LABEL[job.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {job.input.inputText || 'Sin texto'}
                  </p>
                  {job.revisionOfJobId && (
                    <p className="text-[11px] text-brand-700 mt-1">
                      Revisión de {job.revisionOfJobId.slice(0, 8)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Detalle del job</h2>
          {selectedJob && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[selectedJob.status]}`}>
              {STATUS_LABEL[selectedJob.status]}
            </span>
          )}
        </div>

        {!selectedJobId ? (
          <p className="text-sm text-gray-500">Selecciona un job o genera uno nuevo.</p>
        ) : isJobLoading ? (
          <p className="text-sm text-gray-500">Cargando detalle del job...</p>
        ) : !selectedJob ? (
          <p className="text-sm text-gray-500">No se pudo cargar el job seleccionado.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm text-gray-600 break-all">
                <span className="font-medium text-gray-800">ID:</span> {selectedJob.id}
              </p>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1">Input</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedJob.input.inputText}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800 mb-1">Guidelines</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {selectedJob.input.designGuidelines}
                </p>
              </div>
              {selectedJob.approval && (
                <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-800">Reviewer:</span>{' '}
                    {selectedJob.approval.reviewer}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Fecha:</span>{' '}
                    {new Date(selectedJob.approval.reviewedAt).toLocaleString()}
                  </p>
                  {selectedJob.approval.reason && (
                    <p>
                      <span className="font-medium text-gray-800">Razón:</span>{' '}
                      {selectedJob.approval.reason}
                    </p>
                  )}
                </div>
              )}
              {selectedJob.revisionRequest && (
                <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
                  <p>
                    <span className="font-medium">Sugerencia:</span> {selectedJob.revisionRequest.instruction}
                  </p>
                  <p className="mt-1 text-xs text-brand-700">
                    por {selectedJob.revisionRequest.reviewer} ·{' '}
                    {new Date(selectedJob.revisionRequest.requestedAt).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedJob.variants && selectedJob.variants.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Comparador de variantes</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Revisa métricas del crítico y elige la variante final.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {selectedJob.variants.map((variant) => {
                      const isSelectedVariant = selectedJob.selectedVariantId === variant.id;
                      const isRecommendedVariant = recommendedVariantId === variant.id;
                      const subScores = [
                        { key: 'contrast', label: 'Contraste', value: variant.critic?.contrast },
                        { key: 'hierarchy', label: 'Jerarquía', value: variant.critic?.hierarchy },
                        {
                          key: 'brandConsistency',
                          label: 'Consistencia de marca',
                          value: variant.critic?.brandConsistency,
                        },
                        { key: 'textDensity', label: 'Densidad de texto', value: variant.critic?.textDensity },
                      ].filter((score) => typeof score.value === 'number');

                      return (
                        <div
                          key={variant.id}
                          className={`rounded-lg border p-3 space-y-3 ${
                            isSelectedVariant
                              ? 'border-brand-400 bg-brand-50'
                              : isRecommendedVariant
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{variant.label}</p>
                              <p className="text-xs text-gray-500">
                                {PROVIDER_LABELS[variant.provider] ?? variant.provider} · ID {variant.id.slice(0, 8)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {isRecommendedVariant && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  Recomendada
                                </span>
                              )}
                              {isSelectedVariant && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                                  Seleccionada
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-700">
                            <span className="font-medium text-gray-800">Score general:</span>{' '}
                            {typeof variant.critic?.overall === 'number' ? variant.critic.overall.toFixed(1) : 'N/D'}
                          </div>

                          {subScores.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {subScores.map((score) => (
                                <div key={score.key} className="rounded-md bg-gray-50 border border-gray-200 px-2 py-1.5">
                                  <p className="text-gray-500">{score.label}</p>
                                  <p className="font-semibold text-gray-700">{(score.value as number).toFixed(1)}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <button
                            onClick={() => void handleSelectVariant(variant.id, variant.label)}
                            disabled={
                              selectedJob.status !== 'pending_approval' ||
                              isSelectedVariant ||
                              isSelectingVariant
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {isSelectedVariant ? 'Variante activa' : 'Seleccionar variante'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                <label className="block text-sm text-gray-600">
                  Reviewer
                  <input
                    value={reviewer}
                    onChange={(event) => setReviewer(event.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Razón de rechazo
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Obligatoria para rechazar"
                  />
                </label>
                <label className="block text-sm text-gray-600">
                  Sugerir cambios
                  <textarea
                    value={suggestionInstruction}
                    onChange={(event) => setSuggestionInstruction(event.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Ej: mejorar contraste del CTA y reducir texto del body"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => void handleSuggestChanges()}
                    disabled={
                      selectedJob.status !== 'pending_approval' ||
                      !suggestionInstruction.trim() ||
                      isSuggesting
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSuggesting ? 'animate-spin' : ''}`} />
                    Sugerir cambios
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => void handleApprove()}
                    disabled={selectedJob.status !== 'pending_approval' || isApproving}
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Aprobar
                  </button>
                  <button
                    onClick={() => void handleReject()}
                    disabled={selectedJob.status !== 'pending_approval' || !rejectionReason.trim() || isRejecting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    Rechazar
                  </button>
                  <button
                    onClick={() => void handleDeliver()}
                    disabled={
                      (selectedJob.status !== 'approved' && selectedJob.status !== 'delivered') ||
                      isDelivering
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    Entregar
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-800">Delivery</p>
              {selectedImageUrl ? (
                <div className="space-y-3">
                  {selectedJob?.status !== 'delivered' && (
                    <p className="text-xs text-gray-600">
                      Render de selección (pre-entrega).
                    </p>
                  )}
                  <img
                    src={selectedImageUrl}
                    alt="Render generado por AI Image Generator"
                    className="w-full rounded-lg border border-gray-200"
                  />
                  <a
                    href={selectedImageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm text-brand-600 font-medium hover:text-brand-700"
                  >
                    Abrir imagen en nueva pestaña
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  Genera o selecciona una variante para visualizar el render.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
