import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImagePlus,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import {
  agentApprove,
  agentDeliver,
  agentGenerateImage,
  agentGetJob,
  agentGetPendingApprovals,
  agentReject,
  getBrandConfig,
} from '../api/client';
import type { AgentBrandKitInput, AgentGenerateRequest, AgentImageJob } from '../types';

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

export default function AiImageAgentPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [form, setForm] = useState<AgentGenerateRequest>({
    inputText: '',
    designGuidelines: '',
    platform: 'instagram_feed_1x1',
    brandKit: DEFAULT_BRAND_KIT,
  });
  const [pendingApprovals, setPendingApprovals] = useState<AgentImageJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<AgentImageJob | null>(null);
  const [reviewer, setReviewer] = useState('brand-manager');
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deliveryUrl, setDeliveryUrl] = useState<string | null>(null);
  const [isBrandKitLoading, setIsBrandKitLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [isJobLoading, setIsJobLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const selectedImageUrl = useMemo(() => deliveryUrl || previewUrl, [deliveryUrl, previewUrl]);

  const loadPendingApprovals = async (silent = false) => {
    if (!silent) setIsQueueLoading(true);
    try {
      const jobs = await agentGetPendingApprovals();
      setPendingApprovals(jobs);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      if (!silent) setIsQueueLoading(false);
    }
  };

  const loadJob = async (jobId: string, silent = false) => {
    if (!silent) setIsJobLoading(true);
    try {
      const job = await agentGetJob(jobId);
      setSelectedJob(job);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      if (!silent) setIsJobLoading(false);
    }
  };

  useEffect(() => {
    const loadPageData = async () => {
      setIsBrandKitLoading(true);
      try {
        const config = await getBrandConfig();
        setForm((current) => ({
          ...current,
          brandKit: {
            primaryColor: normalizeColor(config.primaryColor, DEFAULT_BRAND_KIT.primaryColor),
            secondaryColor: normalizeColor(config.secondaryColor, DEFAULT_BRAND_KIT.secondaryColor),
            accentColor: normalizeColor(config.accentColor, DEFAULT_BRAND_KIT.accentColor),
            backgroundColor: normalizeColor(config.backgroundColor, DEFAULT_BRAND_KIT.backgroundColor),
            textColor: normalizeColor(config.textColor, DEFAULT_BRAND_KIT.textColor),
            headingFont: config.headingFont?.trim() || DEFAULT_BRAND_KIT.headingFont,
            bodyFont: config.bodyFont?.trim() || DEFAULT_BRAND_KIT.bodyFont,
          },
        }));
      } catch (error) {
        setErrorMessage(`No se pudo cargar el Brand Kit: ${extractErrorMessage(error)}`);
      } finally {
        setIsBrandKitLoading(false);
      }
      await loadPendingApprovals();
    };
    void loadPageData();
  }, []);

  useEffect(() => {
    if (!selectedJobId) return;
    const timer = window.setInterval(() => {
      void loadJob(selectedJobId, true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedJobId]);

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setActionMessage(null);
    setIsGenerating(true);
    try {
      const result = await agentGenerateImage(form);
      setSelectedJobId(result.jobId);
      setPreviewUrl(result.previewUrl);
      setDeliveryUrl(null);
      setActionMessage(`Job ${result.jobId} creado con estado ${STATUS_LABEL[result.status]}.`);
      await Promise.all([loadJob(result.jobId), loadPendingApprovals(true)]);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectJob = async (jobId: string) => {
    setSelectedJobId(jobId);
    setPreviewUrl(null);
    setDeliveryUrl(null);
    await loadJob(jobId);
  };

  const handleApprove = async () => {
    if (!selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsApproving(true);
    try {
      const job = await agentApprove(selectedJobId, reviewer);
      setSelectedJob(job);
      setActionMessage(`Job ${job.id} aprobado por ${reviewer}.`);
      await loadPendingApprovals(true);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsRejecting(true);
    try {
      const job = await agentReject(selectedJobId, reviewer, rejectionReason);
      setSelectedJob(job);
      setActionMessage(`Job ${job.id} rechazado.`);
      await loadPendingApprovals(true);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDeliver = async () => {
    if (!selectedJobId) return;
    setErrorMessage(null);
    setActionMessage(null);
    setIsDelivering(true);
    try {
      const result = await agentDeliver(selectedJobId);
      setDeliveryUrl(result.deliveryUrl);
      setActionMessage('Imagen entregada correctamente.');
      await loadJob(selectedJobId, true);
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsDelivering(false);
    }
  };

  if (!campaignId) {
    return <div className="text-center py-20 text-gray-500">Campaña no encontrada.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/campaigns/${campaignId}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Image Agent</h1>
            <p className="text-sm text-gray-500">Generación visual con aprobación humana</p>
          </div>
        </div>
        <button
          onClick={() => void loadPendingApprovals()}
          disabled={isQueueLoading}
          className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isQueueLoading ? 'animate-spin' : ''}`} />
          Actualizar cola
        </button>
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
                placeholder="Ej: Anuncia nuestro nuevo programa para coaches..."
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
                placeholder="Ej: estilo limpio, jerarquía fuerte, CTA visible..."
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

            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-gray-500" />
                <h3 className="font-medium text-gray-800">Brand Kit (prefill)</h3>
              </div>
              {isBrandKitLoading ? (
                <p className="text-sm text-gray-500">Cargando configuración de marca...</p>
              ) : (
                <>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pendientes de aprobación</h2>
          {isQueueLoading ? (
            <p className="text-sm text-gray-500">Cargando cola...</p>
          ) : pendingApprovals.length === 0 ? (
            <p className="text-sm text-gray-500">No hay jobs pendientes.</p>
          ) : (
            <div className="space-y-2">
              {pendingApprovals.map((job) => (
                <button
                  key={job.id}
                  onClick={() => void handleSelectJob(job.id)}
                  className={`w-full text-left border rounded-lg p-3 transition ${
                    selectedJobId === job.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">{job.id}</p>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {job.input.inputText || 'Sin texto'}
                  </p>
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
          <p className="text-sm text-gray-500">Selecciona un job pendiente o genera uno nuevo.</p>
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
              <p className="text-sm font-medium text-gray-800">Preview / Delivery</p>
              {selectedImageUrl ? (
                <div className="space-y-3">
                  <img
                    src={selectedImageUrl}
                    alt="Preview generado por AI Image Agent"
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
                  Genera o entrega un job para visualizar la imagen final.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
