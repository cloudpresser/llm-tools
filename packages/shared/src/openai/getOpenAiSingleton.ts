import OpenAI from 'openai';
import { getConfig } from '../config';

let openai: OpenAI | null = null;

export async function getOpenAiSingleton(): Promise<OpenAI> {
  if (!openai) {
    const config = await getConfig();
    openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }
  return openai;
}
