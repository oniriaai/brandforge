import { z } from 'zod';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { BrandKit, ContentAnalysisResult } from '../types';

const outputSchema = z.object({
  hook: z.string().min(3),
  headline: z.string().min(6),
  body: z.string().min(10),
  cta: z.string().min(3),
  tone: z.string().min(3),
  visualIntent: z.string().min(8),
  keywordSignals: z.array(z.string().min(2)).min(3).max(8),
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are the Content Analysis Subagent for Instagram creatives.
Convert user text and design guidelines into concise campaign copy blocks.
Stay brand-safe and respect the provided brand voice context.
Return only structured output.`,
  ],
  [
    'human',
    `INPUT TEXT:
{inputText}

DESIGN GUIDELINES:
{designGuidelines}

BRAND KIT:
Primary {primaryColor}
Secondary {secondaryColor}
Accent {accentColor}
Heading Font {headingFont}
Body Font {bodyFont}

Output must optimize for a branded Instagram static post.`,
  ],
]);

export async function runContentAnalysisAgent(
  model: ChatOpenAI,
  inputText: string,
  designGuidelines: string,
  brandKit: BrandKit,
): Promise<ContentAnalysisResult> {
  const structuredModel: any = (model as any).withStructuredOutput(outputSchema);
  const chain: any = prompt.pipe(structuredModel);
  const raw = await chain.invoke({
    inputText,
    designGuidelines,
    ...brandKit,
  });
  return outputSchema.parse(raw);
}
