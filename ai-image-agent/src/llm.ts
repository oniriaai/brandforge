import { ChatOpenAI } from '@langchain/openai';
import { AppConfig } from './config';
import { ConfigurationError } from './errors';

export function createModel(config: AppConfig): ChatOpenAI {
  if (!config.openAiApiKey) {
    throw new ConfigurationError(
      'OPENAI_API_KEY is required to run LangChain subagents.',
    );
  }

  return new ChatOpenAI({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    temperature: 0.4,
  });
}
