import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target, Users, TrendingUp, Megaphone, Archive } from 'lucide-react';
import { getCampaigns, createCampaign } from '../api/client';
import type { Campaign } from '../types';

const OBJECTIVE_LABELS: Record<string, string> = {
  awareness: 'Awareness',
  lead_generation: 'Generación de Leads',
  conversion: 'Conversión',
  engagement: 'Engagement',
  brand_positioning: 'Posicionamiento',
};

const OBJECTIVE_ICONS: Record<string, typeof Target> = {
  awareness: Megaphone,
  lead_generation: Users,
  conversion: TrendingUp,
  engagement: Target,
  brand_positioning: Megaphone,
};

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    objective: 'lead_generation' as Campaign['objective'],
    industry: '',
    targetAudience: '',
    valueProposition: '',
    brandVoice: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCampaign(form);
      setShowCreate(false);
      setForm({ name: '', objective: 'lead_generation', industry: '', targetAudience: '', valueProposition: '', brandVoice: '' });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Campañas</h1>
          <p className="text-gray-500 mt-1">Gestiona tus campañas de contenido de marketing</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 w-full sm:w-auto bg-brand-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition"
        >
          <Plus className="w-5 h-5" />
          Nueva Campaña
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 p-4 flex items-start sm:items-center justify-center z-50 overflow-y-auto">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-xl p-5 sm:p-8 w-full max-w-lg shadow-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
          >
            <h2 className="text-xl font-bold mb-6">Nueva Campaña</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej: Campaña Q1 2026 – Lead Gen"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo</label>
                <select
                  value={form.objective}
                  onChange={(e) => setForm({ ...form, objective: e.target.value as Campaign['objective'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="awareness">Awareness</option>
                  <option value="lead_generation">Generación de Leads</option>
                  <option value="conversion">Conversión</option>
                  <option value="engagement">Engagement</option>
                  <option value="brand_positioning">Posicionamiento de Marca</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industria</label>
                <input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: SaaS, Consultoría, E-commerce"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audiencia Objetivo</label>
                <input
                  value={form.targetAudience}
                  onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: Dueños de negocio entre 30-50 años"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Propuesta de Valor</label>
                <textarea
                  value={form.valueProposition}
                  onChange={(e) => setForm({ ...form, valueProposition: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={2}
                  placeholder="¿Qué ofreces y por qué es diferente?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voz de Marca</label>
                <input
                  value={form.brandVoice}
                  onChange={(e) => setForm({ ...form, brandVoice: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ej: Profesional pero cercano, directo y confiable"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-brand-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-brand-700 w-full sm:w-auto"
              >
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400">Cargando...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20">
          <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No hay campañas aún</p>
          <p className="text-gray-400">Crea tu primera campaña para empezar a generar contenido</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => {
            const Icon = OBJECTIVE_ICONS[c.objective] || Target;
            return (
              <Link
                key={c.id}
                to={`/campaigns/${c.id}`}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-brand-300 transition group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="bg-brand-50 p-2.5 rounded-lg group-hover:bg-brand-100 transition">
                    <Icon className="w-6 h-6 text-brand-600" />
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    c.status === 'active' ? 'bg-green-100 text-green-700' :
                    c.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {c.status}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-gray-900 mb-1">{c.name}</h3>
                <p className="text-sm text-brand-600 font-medium mb-2">
                  {OBJECTIVE_LABELS[c.objective] || c.objective}
                </p>
                {c.targetAudience && (
                  <p className="text-sm text-gray-500 line-clamp-2">{c.targetAudience}</p>
                )}
                <div className="text-xs text-gray-400 mt-4">
                  {new Date(c.updatedAt).toLocaleDateString('es-ES')}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
