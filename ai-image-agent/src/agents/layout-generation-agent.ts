import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import {
  BackgroundSelectionResult,
  ContentAnalysisResult,
  LayoutGenerationResult,
  Platform,
} from '../types';

const outputSchema = z.object({
  textAlign: z.enum(['left', 'center']),
  headlineSize: z.number().int().min(44).max(120),
  bodySize: z.number().int().min(22).max(44),
  ctaSize: z.number().int().min(20).max(34),
  padding: z.number().int().min(40).max(120),
  lineClampHeadline: z.number().int().min(1).max(3),
  lineClampBody: z.number().int().min(2).max(5),
  ctaStyle: z.enum(['solid', 'outline']),
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are the Layout Generation Subagent.
Produce a practical layout spec for Instagram image rendering.
Keep hierarchy readable and conversion-focused.
Return only structured output.`,
  ],
  [
    'human',
    `PLATFORM: {platform}

CONTENT:
Hook: {hook}
Headline: {headline}
Body: {body}
CTA: {cta}
Tone: {tone}

BACKGROUND:
Mood: {moodSummary}
Gradient start: {gradientStart}
Gradient end: {gradientEnd}
Overlay opacity: {overlayOpacity}

Output a render-safe layout with realistic typography and spacing.`,
  ],
]);

export async function runLayoutGenerationAgent(
  model: ChatOpenAI,
  platform: Platform,
  content: ContentAnalysisResult,
  background: BackgroundSelectionResult,
): Promise<LayoutGenerationResult> {
  const structuredModel: any = (model as any).withStructuredOutput(outputSchema);
  const chain: any = prompt.pipe(structuredModel);
  const raw = await chain.invoke({
    platform,
    hook: content.hook,
    headline: content.headline,
    body: content.body,
    cta: content.cta,
    tone: content.tone,
    moodSummary: background.moodSummary,
    gradientStart: background.gradientStart,
    gradientEnd: background.gradientEnd,
    overlayOpacity: background.overlayOpacity,
  });
  return outputSchema.parse(raw);
}
