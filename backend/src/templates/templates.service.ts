import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { BrandConfig, DesignStyle } from '../brand-assets/entities/brand-config.entity';

export interface TemplateSlots {
  headline?: string;
  subheadline?: string;
  body?: string;
  cta?: string;
  hook?: string;
  logoUrl?: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  platform: string;
  description: string;
  width: number;
  height: number;
  htmlFile: string;
}

const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  {
    id: 'ig-1x1-bold',
    name: 'Instagram Bold Statement',
    platform: 'instagram_feed_1x1',
    description: 'Bold hook + CTA for engagement',
    width: 1080,
    height: 1080,
    htmlFile: 'instagram-feed-1x1/bold-statement.html',
  },
  {
    id: 'ig-1x1-educational',
    name: 'Instagram Educational',
    platform: 'instagram_feed_1x1',
    description: 'Headline + body + CTA educational post',
    width: 1080,
    height: 1080,
    htmlFile: 'instagram-feed-1x1/educational.html',
  },
  {
    id: 'ig-4x5-story',
    name: 'Instagram Story/Pain Point',
    platform: 'instagram_feed_4x5',
    description: 'Pain-agitate-solve vertical layout',
    width: 1080,
    height: 1350,
    htmlFile: 'instagram-feed-4x5/pain-solve.html',
  },
  {
    id: 'ig-4x5-value',
    name: 'Instagram Value Prop',
    platform: 'instagram_feed_4x5',
    description: 'Value proposition vertical layout',
    width: 1080,
    height: 1350,
    htmlFile: 'instagram-feed-4x5/value-prop.html',
  },
  {
    id: 'li-horizontal-authority',
    name: 'LinkedIn Authority Post',
    platform: 'linkedin_post',
    description: 'Authority/thought leadership layout',
    width: 1200,
    height: 627,
    htmlFile: 'linkedin-horizontal/authority.html',
  },
  {
    id: 'li-horizontal-insight',
    name: 'LinkedIn Insight Post',
    platform: 'linkedin_post',
    description: 'Insight-driven professional layout',
    width: 1200,
    height: 627,
    htmlFile: 'linkedin-horizontal/insight.html',
  },
];

interface DesignPreset {
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  shadowCard: string;
  shadowButton: string;
  borderWidth: string;
  overlayOpacity: string;
  gradientAngle: string;
  decoratorOpacity: string;
  spacingUnit: string;
  glassBlur: string;
  glassBg: string;
}

const DESIGN_PRESETS: Record<string, DesignPreset> = {
  minimal: {
    radiusSm: '0px', radiusMd: '2px', radiusLg: '4px',
    shadowCard: 'none', shadowButton: 'none',
    borderWidth: '1px', overlayOpacity: '0',
    gradientAngle: '180deg', decoratorOpacity: '0',
    spacingUnit: '1', glassBlur: '0px', glassBg: 'transparent',
  },
  bold: {
    radiusSm: '12px', radiusMd: '20px', radiusLg: '28px',
    shadowCard: '0 20px 60px rgba(0,0,0,0.25)',
    shadowButton: '0 8px 30px rgba(0,0,0,0.3)',
    borderWidth: '3px', overlayOpacity: '0.15',
    gradientAngle: '135deg', decoratorOpacity: '0.3',
    spacingUnit: '1.2', glassBlur: '24px', glassBg: 'rgba(255,255,255,0.15)',
  },
  corporate: {
    radiusSm: '4px', radiusMd: '8px', radiusLg: '12px',
    shadowCard: '0 4px 16px rgba(0,0,0,0.08)',
    shadowButton: '0 2px 8px rgba(0,0,0,0.1)',
    borderWidth: '1px', overlayOpacity: '0.05',
    gradientAngle: '180deg', decoratorOpacity: '0.08',
    spacingUnit: '1', glassBlur: '12px', glassBg: 'rgba(255,255,255,0.08)',
  },
  creative: {
    radiusSm: '8px', radiusMd: '16px', radiusLg: '24px',
    shadowCard: '0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
    shadowButton: '0 6px 20px rgba(0,0,0,0.2)',
    borderWidth: '2px', overlayOpacity: '0.12',
    gradientAngle: '150deg', decoratorOpacity: '0.25',
    spacingUnit: '1.1', glassBlur: '20px', glassBg: 'rgba(255,255,255,0.12)',
  },
  elegant: {
    radiusSm: '2px', radiusMd: '6px', radiusLg: '10px',
    shadowCard: '0 8px 32px rgba(0,0,0,0.06)',
    shadowButton: '0 4px 12px rgba(0,0,0,0.08)',
    borderWidth: '1px', overlayOpacity: '0.04',
    gradientAngle: '170deg', decoratorOpacity: '0.1',
    spacingUnit: '1.15', glassBlur: '16px', glassBg: 'rgba(255,255,255,0.06)',
  },
  modern: {
    radiusSm: '8px', radiusMd: '12px', radiusLg: '20px',
    shadowCard: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
    shadowButton: '0 4px 16px rgba(0,0,0,0.15)',
    borderWidth: '1px', overlayOpacity: '0.08',
    gradientAngle: '135deg', decoratorOpacity: '0.15',
    spacingUnit: '1', glassBlur: '20px', glassBg: 'rgba(255,255,255,0.1)',
  },
};

@Injectable()
export class TemplatesService {
  private templatesDir: string;

  constructor() {
    this.templatesDir = path.resolve(process.cwd(), 'templates');
  }

  getRegistry(): TemplateDefinition[] {
    return TEMPLATE_REGISTRY;
  }

  getByPlatform(platform: string): TemplateDefinition[] {
    return TEMPLATE_REGISTRY.filter((t) => t.platform === platform);
  }

  getById(id: string): TemplateDefinition | undefined {
    return TEMPLATE_REGISTRY.find((t) => t.id === id);
  }

  renderTemplate(
    templateId: string,
    slots: TemplateSlots,
    brandConfig: BrandConfig | null,
  ): string {
    const template = this.getById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const filePath = path.join(this.templatesDir, template.htmlFile);
    let html = fs.readFileSync(filePath, 'utf-8');

    // Inject Google Fonts
    const fontsLink = this.buildGoogleFontsLink(brandConfig);
    html = html.replace('</head>', `${fontsLink}\n</head>`);

    // Inject design tokens from brand config + preset
    const tokens = this.buildDesignTokens(brandConfig);
    html = html.replace('/* __DESIGN_TOKENS__ */', tokens);

    // Inject content slots
    html = html.replace(/\{\{headline\}\}/g, this.escapeHtml(slots.headline || ''));
    html = html.replace(/\{\{subheadline\}\}/g, this.escapeHtml(slots.subheadline || ''));
    html = html.replace(/\{\{body\}\}/g, this.escapeHtml(slots.body || ''));
    html = html.replace(/\{\{cta\}\}/g, this.escapeHtml(slots.cta || ''));
    html = html.replace(/\{\{hook\}\}/g, this.escapeHtml(slots.hook || ''));
    html = html.replace(/\{\{logoUrl\}\}/g, slots.logoUrl || '');

    return html;
  }

  private buildGoogleFontsLink(brandConfig: BrandConfig | null): string {
    const heading = brandConfig?.headingFont || 'Inter';
    const body = brandConfig?.bodyFont || 'Inter';
    const fonts = new Set([heading, body]);
    const families = Array.from(fonts)
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700;800;900`)
      .join('&');
    return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
  }

  private buildDesignTokens(brandConfig: BrandConfig | null): string {
    const c = brandConfig;
    const style = (c?.designStyle as string) || 'modern';
    const p = DESIGN_PRESETS[style] || DESIGN_PRESETS.modern;

    const headingFont = c?.headingFont || 'Inter';
    const bodyFont = c?.bodyFont || 'Inter';

    return `
      --brand-primary: ${c?.primaryColor || '#2563EB'};
      --brand-secondary: ${c?.secondaryColor || '#1E40AF'};
      --brand-accent: ${c?.accentColor || '#F59E0B'};
      --brand-bg: ${c?.backgroundColor || '#FFFFFF'};
      --brand-text: ${c?.textColor || '#1F2937'};
      --font-heading: '${headingFont}', sans-serif;
      --font-body: '${bodyFont}', sans-serif;
      --radius-sm: ${p.radiusSm};
      --radius-md: ${p.radiusMd};
      --radius-lg: ${p.radiusLg};
      --shadow-card: ${p.shadowCard};
      --shadow-button: ${p.shadowButton};
      --border-width: ${p.borderWidth};
      --overlay-opacity: ${p.overlayOpacity};
      --gradient-angle: ${p.gradientAngle};
      --decorator-opacity: ${p.decoratorOpacity};
      --spacing-unit: ${p.spacingUnit};
      --glass-blur: ${p.glassBlur};
      --glass-bg: ${p.glassBg};
    `;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
