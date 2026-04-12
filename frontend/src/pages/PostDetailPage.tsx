import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  Send,
  Image,
  ImagePlus,
  Clock,
  Download,
  Eye,
} from 'lucide-react';
import {
  getPost,
  getPostsByCampaign,
  toggleFavorite,
  refineContent,
  getTemplates,
  renderPost,
  getPreviewHtml,
} from '../api/client';
import type { ContentPost, TemplateDefinition } from '../types';

interface ChatMessage {
  role: 'user' | 'system';
  text: string;
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<ContentPost | null>(null);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [generatedVariants, setGeneratedVariants] = useState<ContentPost[]>([]);
  const [showVariants, setShowVariants] = useState(false);

  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [refining, setRefining] = useState(false);
  const [rendering, setRendering] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!id) return;
    const p = await getPost(id);
    setPost(p);
    const [tpls, campaignPosts] = await Promise.all([
      getTemplates(p.platform),
      getPostsByCampaign(p.campaignId),
    ]);
    setTemplates(tpls);
    const nextTemplate = p.templateId && tpls.some((t) => t.id === p.templateId)
      ? p.templateId
      : tpls[0]?.id || '';
    setSelectedTemplate(nextTemplate);
    setGeneratedVariants(
      campaignPosts
        .filter((candidate) => candidate.platform === p.platform && candidate.objective === p.objective)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    );
    if (!id) return;
    if (previewHtml && nextTemplate) {
      try {
        const res = await getPreviewHtml(id, nextTemplate);
        setPreviewHtml(res.html);
        setPreviewSize({ width: res.width, height: res.height });
      } catch {
        setPreviewHtml('');
      }
    } else if (!previewHtml) {
      setPreviewSize({ width: 0, height: 0 });
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const refreshPreview = async (templateId: string) => {
    if (!id || !templateId) return;
    const res = await getPreviewHtml(id, templateId);
    setPreviewHtml(res.html);
    setPreviewSize({ width: res.width, height: res.height });
  };

  const handleSwitchVariant = (variantId: string) => {
    if (variantId === id) return;
    setShowVariants(false);
    navigate(`/posts/${variantId}`);
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !chatInput.trim()) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: instruction }]);
    setRefining(true);
    try {
      const refined = await refineContent({ postId: id, instruction });
      setPost({ ...refined, renderedImageUrl: null });
      if (selectedTemplate && previewHtml) {
        try {
          await refreshPreview(selectedTemplate);
        } catch {
          setChatMessages((prev) => [
            ...prev,
            { role: 'system', text: 'Contenido refinado, pero no se pudo actualizar el preview.' },
          ]);
        }
      }
      setChatMessages((prev) => [
        ...prev,
        { role: 'system', text: 'Contenido refinado. Revisa los cambios.' },
      ]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'system', text: 'Error al refinar. Inténtalo de nuevo.' }]);
    }
    setRefining(false);
  };

  const handlePreview = async () => {
    if (!id || !selectedTemplate) return;
    try {
      await refreshPreview(selectedTemplate);
    } catch {
      alert('Error al generar preview');
    }
  };

  const handleRender = async () => {
    if (!id || !selectedTemplate) return;
    setRendering(true);
    try {
      const res = await renderPost(id, selectedTemplate);
      setPost((prev) => prev ? { ...prev, renderedImageUrl: res.imageUrl } : prev);
      setChatMessages((prev) => [...prev, { role: 'system', text: 'Imagen renderizada exitosamente.' }]);

      // Auto-download the PNG
      const filename = res.imageUrl.split('/').pop();
      const blob = await fetch(`/api/render/image/${filename}`).then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'post.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al renderizar');
    }
    setRendering(false);
  };

  const handleToggleFav = async () => {
    if (!id) return;
    const p = await toggleFavorite(id);
    setPost(p);
  };

  if (!post) return <div className="text-center py-20 text-gray-400">Cargando...</div>;
  const currentVariantIndex = generatedVariants.findIndex((variant) => variant.id === post.id);
  const renderedImageHref = post.renderedImageUrl
    ? post.renderedImageUrl.startsWith('http://') || post.renderedImageUrl.startsWith('https://')
      ? post.renderedImageUrl
      : `/api/render/image/${post.renderedImageUrl.split('/').pop()}`
    : null;
  const isExternalRenderedImage = !!renderedImageHref && renderedImageHref.startsWith('http');

  const QUICK_PROMPTS = [
    'Hazlo más vendedor',
    'Más emocional',
    'Más directo y corto',
    'Más técnico y profesional',
    'Enfocado en dueños de negocio',
    'Agrega urgencia',
    'Más casual y cercano',
    'Más datos y autoridad',
  ];

  return (
    <div className="flex flex-col gap-6 xl:flex-row min-h-[calc(100vh-130px)]">
      {/* Left — Content details */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">Detalle del Post</h1>
          <Link
            to={`/posts/${post.id}/ai-image-agent`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ImagePlus className="w-4 h-4" />
            Generar imagen AI
          </Link>
          <button onClick={handleToggleFav} className="p-2 rounded-lg hover:bg-gray-100">
            <Star className={`w-5 h-5 ${post.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
          </button>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-100 text-brand-700">
            {post.platform.replace(/_/g, ' ')}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
            {post.marketingAngle.replace(/_/g, ' ')}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
            {post.objective}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            Variante {currentVariantIndex >= 0 ? currentVariantIndex + 1 : 1}
          </span>
        </div>

        {/* Content fields */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Hook</label>
            <p className="text-lg font-bold text-gray-900 mt-1">{post.hook}</p>
          </div>
          {post.headline && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Headline</label>
              <p className="font-semibold text-brand-700 mt-1">{post.headline}</p>
            </div>
          )}
          {post.subheadline && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subheadline</label>
              <p className="text-gray-700 mt-1">{post.subheadline}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Body</label>
            <p className="text-gray-700 mt-1 whitespace-pre-wrap">{post.body}</p>
          </div>
          <div className="bg-brand-50 rounded-lg px-4 py-3">
            <label className="text-xs font-semibold text-brand-500 uppercase tracking-wider">CTA</label>
            <p className="font-semibold text-brand-800 mt-1">{post.cta}</p>
          </div>
          {post.caption && (
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Caption</label>
              <p className="text-gray-600 mt-1 text-sm whitespace-pre-wrap">{post.caption}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Audiencia</label>
              <p className="text-sm text-gray-700 mt-1">{post.targetAudience}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tono</label>
              <p className="text-sm text-gray-700 mt-1">{post.tone}</p>
            </div>
            {post.painPoint && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pain Point</label>
                <p className="text-sm text-gray-700 mt-1">{post.painPoint}</p>
              </div>
            )}
            {post.valueProposition && (
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Propuesta de Valor</label>
                <p className="text-sm text-gray-700 mt-1">{post.valueProposition}</p>
              </div>
            )}
          </div>
        </div>

        {/* Template & Render */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Plantilla & Render</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500">Plantilla</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-1 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePreview}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={handleRender}
              disabled={rendering}
              className="flex items-center justify-center gap-1.5 w-full sm:w-auto bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              <Image className="w-4 h-4" />
              {rendering ? 'Renderizando...' : 'Exportar PNG'}
            </button>
          </div>

          {previewHtml && (
            <div className="mt-4 border border-gray-200 rounded-lg overflow-auto">
              <div
                style={{
                  transform: `scale(${Math.min(600 / previewSize.width, 1)})`,
                  transformOrigin: 'top left',
                  width: previewSize.width,
                  height: previewSize.height,
                }}
              >
                <iframe
                  key={`${selectedTemplate}-${post.id}-${post.updatedAt}`}
                  srcDoc={previewHtml}
                  style={{ width: previewSize.width, height: previewSize.height, border: 'none' }}
                  title="Preview"
                />
              </div>
            </div>
          )}

          {renderedImageHref && (
            <div className="mt-4">
              <a
                href={renderedImageHref}
                download={isExternalRenderedImage ? undefined : true}
                target={isExternalRenderedImage ? '_blank' : undefined}
                rel={isExternalRenderedImage ? 'noreferrer' : undefined}
                className="flex items-center gap-2 text-brand-600 text-sm font-medium hover:text-brand-700"
              >
                <Download className="w-4 h-4" />
                {isExternalRenderedImage ? 'Abrir última imagen entregada' : 'Descargar última imagen renderizada'}
              </a>
            </div>
          )}
        </div>

        {/* Generated variants */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold text-gray-900">Variantes Generadas</h3>
            <button
              onClick={() => setShowVariants((prev) => !prev)}
              className="text-sm text-brand-600 font-medium hover:text-brand-700 flex items-center gap-1"
            >
              <Clock className="w-4 h-4" />
              {showVariants ? 'Ocultar variantes' : 'Ver variantes'}
            </button>
          </div>
          {showVariants && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {generatedVariants.map((variant, index) => (
                <div
                  key={variant.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">Variante {index + 1}</span>
                    <span className="text-xs text-gray-500 ml-2">{variant.marketingAngle.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(variant.createdAt).toLocaleString('es-ES')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSwitchVariant(variant.id)}
                    disabled={variant.id === post.id}
                    className="text-xs text-brand-600 font-medium hover:text-brand-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {variant.id === post.id ? 'Actual' : 'Abrir'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right — Refinement Chat */}
      <div className="w-full xl:w-96 flex flex-col bg-white rounded-xl border border-gray-200 min-h-[420px] xl:min-h-0">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Chat de Refinamiento</h3>
          <p className="text-xs text-gray-500">Pide cambios al contenido en lenguaje natural</p>
        </div>

        {/* Quick prompts */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setChatInput(prompt)}
              className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full hover:bg-brand-50 hover:text-brand-600 transition"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px]">
          {chatMessages.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-8">
              Escribe una instrucción para refinar el contenido
            </p>
          )}
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`text-sm px-3 py-2 rounded-lg max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white ml-auto'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {msg.text}
            </div>
          ))}
          {refining && (
            <div className="bg-gray-100 text-gray-500 text-sm px-3 py-2 rounded-lg flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
              Refinando...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <form onSubmit={handleRefine} className="px-4 py-3 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ej: hazlo más vendedor..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              disabled={refining}
            />
            <button
              type="submit"
              disabled={refining || !chatInput.trim()}
              className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
