import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { generateContent } from '../api/client';
import type { Platform, PostObjective, MarketingAngle, GenerateRequest } from '../types';

export default function GeneratePage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<GenerateRequest>({
    campaignId: campaignId || '',
    platform: 'instagram_feed_1x1' as Platform,
    objective: 'lead' as PostObjective,
    variants: 3,
    topic: '',
    targetAudience: '',
    additionalContext: '',
  });

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await generateContent({ ...form, campaignId: campaignId || '' });
      navigate(`/campaigns/${campaignId}`);
    } catch (err) {
      console.error(err);
      alert('Error al generar contenido. Verifica tu API key de OpenAI.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto w-full">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 sm:mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver
      </button>

      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-brand-100 p-2.5 rounded-lg">
            <Sparkles className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Generar Contenido</h1>
            <p className="text-sm text-gray-500">La IA creará variantes de marketing sobre tu tema</p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plataforma</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="instagram_feed_1x1">Instagram Feed 1:1</option>
              <option value="instagram_feed_4x5">Instagram Feed 4:5</option>
              <option value="instagram_carousel">Instagram Carrusel</option>
              <option value="linkedin_post">LinkedIn Post</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo del Post</label>
            <select
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value as PostObjective })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="awareness">Awareness</option>
              <option value="lead">Generación de Leads</option>
              <option value="conversion">Conversión</option>
              <option value="engagement">Engagement</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ángulo de Marketing (opcional — la IA elige si lo dejas vacío)
            </label>
            <select
              value={form.marketingAngle || ''}
              onChange={(e) => setForm({ ...form, marketingAngle: (e.target.value || undefined) as MarketingAngle | undefined })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Automático (según objetivo)</option>
              <option value="educational">Educativo</option>
              <option value="storytelling">Storytelling</option>
              <option value="direct_sale">Venta Directa</option>
              <option value="authority">Autoridad</option>
              <option value="social_proof">Prueba Social</option>
              <option value="pain_agitate_solve">Dolor → Agitar → Resolver</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tema / Enfoque</label>
            <input
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Ej: Cómo escalar un negocio de servicios con IA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Audiencia Objetivo (override)
            </label>
            <input
              value={form.targetAudience}
              onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Deja vacío para usar la audiencia de la campaña"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contexto Adicional</label>
            <textarea
              value={form.additionalContext}
              onChange={(e) => setForm({ ...form, additionalContext: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              rows={3}
              placeholder="Cualquier detalle extra que la IA deba considerar..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Variantes a generar
            </label>
            <select
              value={form.variants}
              onChange={(e) => setForm({ ...form, variants: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={1}>1 variante</option>
              <option value={2}>2 variantes</option>
              <option value={3}>3 variantes</option>
              <option value={4}>4 variantes</option>
              <option value={5}>5 variantes</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3 rounded-lg font-semibold hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generando variantes...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generar Contenido
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
