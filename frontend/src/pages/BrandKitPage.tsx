import { useEffect, useState, useCallback, useRef } from 'react';
import { Check, Upload, X, Save } from 'lucide-react';
import { getBrandConfig, updateBrandConfig, uploadBrandAsset } from '../api/client';
import type { BrandConfig, DesignStyle } from '../types';

const GOOGLE_FONTS = [
  'Inter', 'Poppins', 'Montserrat', 'Roboto', 'Playfair Display',
  'Merriweather', 'Raleway', 'Oswald', 'Nunito', 'DM Sans',
  'Space Grotesk', 'Archivo', 'Lato', 'Open Sans', 'Source Sans 3',
];

const DESIGN_STYLES: { id: DesignStyle; label: string; desc: string; accent: string }[] = [
  { id: 'minimal', label: 'Minimal', desc: 'Limpio, sin sombras, mucho espacio', accent: '#64748B' },
  { id: 'bold', label: 'Bold', desc: 'Sombras fuertes, gradients saturados', accent: '#EF4444' },
  { id: 'corporate', label: 'Corporate', desc: 'Profesional, estructurado, serio', accent: '#3B82F6' },
  { id: 'creative', label: 'Creative', desc: 'Formas únicas, asimetría, dinámico', accent: '#A855F7' },
  { id: 'elegant', label: 'Elegant', desc: 'Refinado, líneas delicadas, serif', accent: '#D4A574' },
  { id: 'modern', label: 'Modern', desc: 'Glass effects, contemporáneo, pulido', accent: '#06B6D4' },
];

const COLOR_FIELDS: { key: keyof BrandConfig; label: string; defaultVal: string }[] = [
  { key: 'primaryColor', label: 'Primario', defaultVal: '#2563EB' },
  { key: 'secondaryColor', label: 'Secundario', defaultVal: '#1E40AF' },
  { key: 'accentColor', label: 'Acento', defaultVal: '#F59E0B' },
  { key: 'backgroundColor', label: 'Fondo', defaultVal: '#FFFFFF' },
  { key: 'textColor', label: 'Texto', defaultVal: '#1F2937' },
];

export default function BrandKitPage() {
  const [config, setConfig] = useState<BrandConfig | null>(null);
  const [draft, setDraft] = useState<Partial<BrandConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const c = await getBrandConfig();
    setConfig(c);
    setDraft({
      primaryColor: c.primaryColor,
      secondaryColor: c.secondaryColor,
      accentColor: c.accentColor,
      backgroundColor: c.backgroundColor,
      textColor: c.textColor,
      headingFont: c.headingFont,
      bodyFont: c.bodyFont,
      designStyle: c.designStyle,
    });
    if (c.logoAssetId) {
      setLogoPreview('/api/brand-assets/logo');
    }
  };

  useEffect(() => { load(); }, []);

  // Load Google Font dynamically
  const loadFont = useCallback((font: string) => {
    if (loadedFonts.has(font)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
    setLoadedFonts(prev => new Set(prev).add(font));
  }, [loadedFonts]);

  useEffect(() => {
    GOOGLE_FONTS.forEach(f => loadFont(f));
  }, []);

  const updateDraft = (key: string, value: string) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateBrandConfig(draft);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Error al guardar');
    }
    setSaving(false);
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadBrandAsset('logo', file);
      setLogoPreview('/api/brand-assets/logo?t=' + Date.now());
      await load();
    } catch {
      alert('Error al subir logo');
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleLogoUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLogoUpload(file);
  };

  // Build preview tokens
  const previewTokens = () => {
    const d = draft;
    return `
      --brand-primary: ${d.primaryColor || '#2563EB'};
      --brand-secondary: ${d.secondaryColor || '#1E40AF'};
      --brand-accent: ${d.accentColor || '#F59E0B'};
      --brand-bg: ${d.backgroundColor || '#FFFFFF'};
      --brand-text: ${d.textColor || '#1F2937'};
      --font-heading: '${d.headingFont || 'Inter'}', sans-serif;
      --font-body: '${d.bodyFont || 'Inter'}', sans-serif;
      --radius-md: 12px;
      --radius-lg: 20px;
      --shadow-card: 0 8px 32px rgba(0,0,0,0.12);
      --shadow-button: 0 4px 16px rgba(0,0,0,0.15);
      --border-width: 1px;
      --glass-bg: rgba(255,255,255,0.1);
      --glass-blur: 20px;
      --gradient-angle: 135deg;
      --decorator-opacity: 0.15;
      --spacing-unit: 1;
      --overlay-opacity: 0.08;
    `;
  };

  const previewHtml = `<!DOCTYPE html>
<html><head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(draft.headingFont || 'Inter')}:wght@700;800;900&family=${encodeURIComponent(draft.bodyFont || 'Inter')}:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root { ${previewTokens()} }
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width: 540px; height: 540px; overflow: hidden;
  font-family: var(--font-body);
  background: radial-gradient(ellipse at 20% 80%, color-mix(in srgb, var(--brand-accent) 25%, transparent) 0%, transparent 50%),
    linear-gradient(var(--gradient-angle), var(--brand-primary) 0%, var(--brand-secondary) 100%);
  color: #fff;
  display: flex; flex-direction: column; justify-content: center; align-items: center;
  padding: 40px; text-align: center; position: relative;
}
body::before {
  content:''; position:absolute; top:-40px; right:-40px;
  width:180px; height:180px; border-radius:50%;
  background: var(--brand-accent); opacity: var(--decorator-opacity);
}
.content { position:relative; z-index:1; }
.headline {
  font-family: var(--font-heading);
  font-size: 36px; font-weight: 900; line-height: 1.05;
  margin-bottom: 18px; letter-spacing: -1px;
}
.card {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: var(--radius-lg);
  padding: 14px 20px; margin-bottom: 20px;
}
.body-text { font-size: 14px; line-height: 1.55; opacity: 0.92; }
.cta {
  display: inline-block;
  background: linear-gradient(135deg, var(--brand-accent), color-mix(in srgb, var(--brand-accent) 80%, #fff));
  color: var(--brand-text);
  font-family: var(--font-heading);
  font-size: 14px; font-weight: 700;
  padding: 12px 28px; border-radius: var(--radius-lg);
  box-shadow: var(--shadow-button);
}
${logoPreview ? `.logo { width:32px; height:32px; object-fit:contain; position:absolute; top:20px; left:20px; border-radius:4px; }` : ''}
</style></head><body>
${logoPreview ? `<img class="logo" src="${logoPreview}" alt="" onerror="this.style.display='none'">` : ''}
<div class="content">
  <div class="headline">Tu marca, tu estilo</div>
  <div class="card"><div class="body-text">Así se verán tus posts generados con esta configuración de identidad visual.</div></div>
  <div class="cta">Descubre más →</div>
</div>
</body></html>`;

  if (!config) return <div className="text-center py-20 text-gray-400">Cargando brand kit...</div>;

  return (
    <div className="flex gap-8 min-h-[calc(100vh-130px)]">
      {/* Left — Controls */}
      <div className="flex-1 space-y-8 overflow-y-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Kit</h1>
          <p className="text-sm text-gray-500 mt-1">Configura la identidad visual que se aplicará a todos los templates</p>
        </div>

        {/* Colors */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Colores</h2>
          <div className="grid grid-cols-5 gap-4">
            {COLOR_FIELDS.map(({ key, label, defaultVal }) => (
              <div key={key} className="flex flex-col items-center gap-2">
                <div className="relative">
                  <input
                    type="color"
                    value={(draft[key] as string) || defaultVal}
                    onChange={(e) => updateDraft(key, e.target.value)}
                    className="w-16 h-16 rounded-xl border-2 border-gray-200 cursor-pointer p-0 overflow-hidden"
                    style={{ WebkitAppearance: 'none' }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">{label}</span>
                <span className="text-[10px] font-mono text-gray-400 uppercase">{(draft[key] as string) || defaultVal}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Fonts */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tipografía</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fuente de títulos</label>
              <select
                value={draft.headingFont || 'Inter'}
                onChange={(e) => updateDraft('headingFont', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                style={{ fontFamily: `'${draft.headingFont || 'Inter'}', sans-serif` }}
              >
                {GOOGLE_FONTS.map(f => (
                  <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>
                ))}
              </select>
              <p className="mt-2 text-xl font-bold" style={{ fontFamily: `'${draft.headingFont || 'Inter'}', sans-serif` }}>
                Así se ve tu título
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Fuente de cuerpo</label>
              <select
                value={draft.bodyFont || 'Inter'}
                onChange={(e) => updateDraft('bodyFont', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
                style={{ fontFamily: `'${draft.bodyFont || 'Inter'}', sans-serif` }}
              >
                {GOOGLE_FONTS.map(f => (
                  <option key={f} value={f} style={{ fontFamily: `'${f}', sans-serif` }}>{f}</option>
                ))}
              </select>
              <p className="mt-2 text-sm" style={{ fontFamily: `'${draft.bodyFont || 'Inter'}', sans-serif` }}>
                Este es un ejemplo de texto de cuerpo para tus publicaciones de marketing.
              </p>
            </div>
          </div>
        </section>

        {/* Logo */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Logo</h2>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 transition"
          >
            {logoPreview ? (
              <div className="flex items-center gap-4">
                <img src={logoPreview} alt="Logo" className="w-20 h-20 object-contain rounded-lg bg-gray-100 p-2" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium">Logo cargado</p>
                  <p className="text-xs text-gray-400 mt-1">Click o arrastra para reemplazar</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">Arrastra tu logo aquí o haz click</p>
                <p className="text-xs text-gray-400">PNG, SVG, JPEG — max 10MB</p>
              </>
            )}
            {uploading && <p className="text-xs text-brand-600 font-medium">Subiendo...</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </section>

        {/* Design Style */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Estilo de Diseño</h2>
          <div className="grid grid-cols-3 gap-3">
            {DESIGN_STYLES.map(style => {
              const isSelected = (draft.designStyle || 'modern') === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => updateDraft('designStyle', style.id)}
                  className={`relative p-4 rounded-xl border-2 text-left transition ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className="w-8 h-8 rounded-lg mb-2"
                    style={{ background: style.accent }}
                  />
                  <p className="text-sm font-semibold text-gray-900">{style.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{style.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-3.5 rounded-xl font-semibold text-base hover:bg-brand-700 disabled:opacity-50 transition"
        >
          {saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar Brand Kit'}
        </button>
      </div>

      {/* Right — Live Preview */}
      <div className="w-[400px] flex-shrink-0">
        <div className="sticky top-8">
          <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider">Preview en vivo</h3>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div style={{ transform: 'scale(0.74)', transformOrigin: 'top left', width: 540, height: 540 }}>
              <iframe
                srcDoc={previewHtml}
                style={{ width: 540, height: 540, border: 'none' }}
                title="Brand Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Vista previa del template "Bold Statement"</p>
        </div>
      </div>
    </div>
  );
}
