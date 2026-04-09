import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { BackgroundSelectionResult, BrandKit, ContentAnalysisResult } from '../types';

const outputSchema = z.object({
  gradientStart: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  gradientEnd: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  overlayOpacity: z.number().min(0).max(0.5),
  highlightColor: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  moodSummary: z.string().min(8),
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are the Background Selection Subagent.
Choose a brand-safe background strategy for a single Instagram creative.
Prioritize readability and contrast for text overlays.
Return only structured output.`,
  ],
  [
    'human',
    `CONTENT INTENT:
Headline: {headline}
Tone: {tone}
Visual Intent: {visualIntent}
Keyword Signals: {keywordSignals}

DESIGN GUIDELINES:
{designGuidelines}

BRAND KIT:
Primary {primaryColor}
Secondary {secondaryColor}
Accent {accentColor}
Background {backgroundColor}
Text {textColor}`,
  ],
]);

export async function runBackgroundSelectionAgent(
  model: ChatOpenAI,
  content: ContentAnalysisResult,
  designGuidelines: string,
  brandKit: BrandKit,
): Promise<BackgroundSelectionResult> {
  const structuredModel: any = (model as any).withStructuredOutput(outputSchema);
  const chain: any = prompt.pipe(structuredModel);
  const raw = await chain.invoke({
    headline: content.headline,
    tone: content.tone,
    visualIntent: content.visualIntent,
    keywordSignals: content.keywordSignals.join(', '),
    designGuidelines,
    ...brandKit,
  });
  return outputSchema.parse(raw);
}
