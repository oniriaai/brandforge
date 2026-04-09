import * as path from 'path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  RENDER_OUTPUT_DIR: z.string().default('rendered'),
  DELIVERY_BASE_URL: z.string().url().default('http://localhost:4100'),
});

export interface AppConfig {
  port: number;
  openAiApiKey?: string;
  openAiModel: string;
  renderOutputDir: string;
  deliveryBaseUrl: string;
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  return {
    port: parsed.PORT,
    openAiApiKey: parsed.OPENAI_API_KEY,
    openAiModel: parsed.OPENAI_MODEL,
    renderOutputDir: path.resolve(process.cwd(), parsed.RENDER_OUTPUT_DIR),
    deliveryBaseUrl: parsed.DELIVERY_BASE_URL,
  };
}
