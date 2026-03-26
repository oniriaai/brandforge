import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { ContentPost, MarketingAngle } from '../content/entities/content-post.entity';
import { BrandConfig } from '../brand-assets/entities/brand-config.entity';
import { GenerateContentDto, GeneratedContent } from './dto/generation.dto';

@Injectable()
export class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get('OPENAI_API_KEY'),
    });
    this.model = this.config.get('OPENAI_MODEL', 'gpt-4o');
  }

  async generateVariants(
    dto: GenerateContentDto,
    campaign: Campaign,
    brandConfig: BrandConfig | null,
  ): Promise<GeneratedContent[]> {
    const variantCount = dto.variants || 3;
    const angles = dto.marketingAngle
      ? [dto.marketingAngle]
      : this.selectAngles(dto.objective, variantCount);

    const results: GeneratedContent[] = [];

    for (const angle of angles) {
      const content = await this.generateSingleVariant(
        dto,
        campaign,
        brandConfig,
        angle,
      );
      results.push(content);
    }

    return results;
  }

  async refineContent(
    post: ContentPost,
    instruction: string,
    campaign: Campaign,
  ): Promise<Partial<GeneratedContent>> {
    const systemPrompt = this.buildRefinementSystemPrompt();
    const userPrompt = this.buildRefinementUserPrompt(post, instruction, campaign);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    return JSON.parse(raw) as Partial<GeneratedContent>;
  }

  private async generateSingleVariant(
    dto: GenerateContentDto,
    campaign: Campaign,
    brandConfig: BrandConfig | null,
    angle: MarketingAngle,
  ): Promise<GeneratedContent> {
    const systemPrompt = this.buildSystemPrompt(dto.platform);
    const userPrompt = this.buildUserPrompt(dto, campaign, brandConfig, angle);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const raw = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    return {
      hook: parsed.hook || '',
      headline: parsed.headline || '',
      subheadline: parsed.subheadline || '',
      body: parsed.body || '',
      cta: parsed.cta || '',
      caption: parsed.caption || '',
      painPoint: parsed.pain_point || dto.topic || '',
      valueProposition: parsed.value_proposition || campaign.valueProposition || '',
      tone: parsed.tone || 'professional',
      marketingAngle: angle,
      targetAudience: dto.targetAudience || campaign.targetAudience || '',
    };
  }

  private buildSystemPrompt(platform: string): string {
    return `You are an elite marketing copywriter and content strategist specializing in social media content for ${platform.replace(/_/g, ' ')}.

You create content that CONVERTS — not generic AI text.

RULES:
- Every piece MUST have a clear marketing objective
- Hooks must stop the scroll — use pattern interrupts, bold claims, or contrarian takes
- Body copy must deliver value and build desire
- CTAs must be specific and action-oriented (never "Learn more")
- Captions must be optimized for the platform's algorithm
- Write like a top-tier marketer, NOT like an AI
- Use power words, emotional triggers, and persuasion frameworks
- Keep copy concise and punchy — no filler

OUTPUT FORMAT: JSON with these exact fields:
{
  "hook": "The scroll-stopping opening line",
  "headline": "Main headline for the visual post",
  "subheadline": "Supporting headline",
  "body": "Body copy for the visual post (2-4 sentences max)",
  "cta": "Specific call-to-action",
  "caption": "Full social media caption with hashtags",
  "pain_point": "The core pain point addressed",
  "value_proposition": "The core promise/benefit",
  "tone": "The tone used (e.g., bold, empathetic, authoritative)"
}`;
  }

  private buildUserPrompt(
    dto: GenerateContentDto,
    campaign: Campaign,
    brandConfig: BrandConfig | null,
    angle: MarketingAngle,
  ): string {
    const parts: string[] = [];

    parts.push(`CAMPAIGN: ${campaign.name}`);
    parts.push(`INDUSTRY: ${campaign.industry || 'Not specified'}`);
    parts.push(`OBJECTIVE: ${dto.objective}`);
    parts.push(`MARKETING ANGLE: ${angle}`);
    parts.push(`PLATFORM: ${dto.platform}`);
    parts.push(`TARGET AUDIENCE: ${dto.targetAudience || campaign.targetAudience || 'General professional audience'}`);

    if (campaign.valueProposition) {
      parts.push(`VALUE PROPOSITION: ${campaign.valueProposition}`);
    }
    if (campaign.painPoints?.length) {
      parts.push(`PAIN POINTS: ${campaign.painPoints.join(', ')}`);
    }
    if (campaign.brandVoice) {
      parts.push(`BRAND VOICE: ${campaign.brandVoice}`);
    }
    if (dto.topic) {
      parts.push(`TOPIC/FOCUS: ${dto.topic}`);
    }
    if (dto.additionalContext) {
      parts.push(`ADDITIONAL CONTEXT: ${dto.additionalContext}`);
    }

    parts.push('');
    parts.push(this.getAngleInstructions(angle));
    parts.push('');
    parts.push(this.getPlatformConstraints(dto.platform));

    return parts.join('\n');
  }

  private buildRefinementSystemPrompt(): string {
    return `You are an elite marketing copywriter. You will receive existing post content and a refinement instruction.
Your job is to refine the content according to the instruction while maintaining the marketing structure.

OUTPUT FORMAT: JSON with ONLY the fields that changed. Use the same field names:
hook, headline, subheadline, body, cta, caption, pain_point, value_proposition, tone

Only include fields you actually modified.`;
  }

  private buildRefinementUserPrompt(
    post: ContentPost,
    instruction: string,
    campaign: Campaign,
  ): string {
    return `CURRENT CONTENT:
Hook: ${post.hook}
Headline: ${post.headline || ''}
Subheadline: ${post.subheadline || ''}
Body: ${post.body}
CTA: ${post.cta}
Caption: ${post.caption || ''}
Tone: ${post.tone || ''}

CAMPAIGN CONTEXT:
Name: ${campaign.name}
Industry: ${campaign.industry || 'N/A'}
Target: ${post.targetAudience}
Objective: ${post.objective}

REFINEMENT INSTRUCTION: "${instruction}"

Apply the refinement while keeping the content marketing-focused and conversion-oriented.`;
  }

  private getAngleInstructions(angle: MarketingAngle): string {
    const map: Record<MarketingAngle, string> = {
      [MarketingAngle.EDUCATIONAL]: 'ANGLE: Educational — Teach something valuable. Position the brand as an expert. Use "Did you know..." or "X mistakes that..." frameworks. The reader should learn AND want more.',
      [MarketingAngle.STORYTELLING]: 'ANGLE: Storytelling — Tell a compelling mini-story. Use the hero\'s journey or before/after framework. Create emotional connection. Make it relatable to the target audience.',
      [MarketingAngle.DIRECT_SALE]: 'ANGLE: Direct Sale — Be bold and direct. Lead with the offer or transformation. Use urgency and scarcity if appropriate. Make the CTA impossible to ignore.',
      [MarketingAngle.AUTHORITY]: 'ANGLE: Authority — Position as the undisputed expert. Use data, results, or credentials. Make contrarian or bold statements. Build trust through competence.',
      [MarketingAngle.SOCIAL_PROOF]: 'ANGLE: Social Proof — Lead with results, testimonials, or case studies. Use specific numbers and outcomes. Show that others have succeeded.',
      [MarketingAngle.PAIN_AGITATE_SOLVE]: 'ANGLE: Pain-Agitate-Solve — Identify the pain point, amplify the consequences, then present the solution. Make the reader feel understood before offering the fix.',
    };
    return map[angle] || '';
  }

  private getPlatformConstraints(platform: string): string {
    if (platform.startsWith('instagram')) {
      return `PLATFORM CONSTRAINTS (Instagram):
- Headline: max 60 chars (displays on image)
- Body text on image: max 120 chars
- Caption: 150-300 chars for optimal engagement (can go up to 2200)
- Use 3-5 relevant hashtags
- Hook must work in the first line (before "...more")
- CTA should fit naturally`;
    }
    return `PLATFORM CONSTRAINTS (LinkedIn):
- Headline: can be longer, up to 100 chars
- Body text: professional tone, insight-driven
- Caption/Post text: 200-500 chars optimal (can go up to 3000)
- Use 3-5 relevant hashtags at the end
- Hook must work in the first 2 lines (before "see more")
- Include a clear CTA`;
  }

  private selectAngles(objective: string, count: number): MarketingAngle[] {
    const anglesByObjective: Record<string, MarketingAngle[]> = {
      awareness: [MarketingAngle.EDUCATIONAL, MarketingAngle.STORYTELLING, MarketingAngle.AUTHORITY],
      lead: [MarketingAngle.PAIN_AGITATE_SOLVE, MarketingAngle.EDUCATIONAL, MarketingAngle.SOCIAL_PROOF],
      conversion: [MarketingAngle.DIRECT_SALE, MarketingAngle.PAIN_AGITATE_SOLVE, MarketingAngle.SOCIAL_PROOF],
      engagement: [MarketingAngle.STORYTELLING, MarketingAngle.EDUCATIONAL, MarketingAngle.AUTHORITY],
    };
    const pool = anglesByObjective[objective] || Object.values(MarketingAngle);
    return pool.slice(0, count);
  }
}
