import OpenAI from "openai";
import { loadEnv } from "../../loadEnv";

export function createOpenAIClient() {
  const env = loadEnv();
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY ?? undefined,
    organization: env.OPENAI_ORG_ID ?? undefined
  });
}

export const openai = createOpenAIClient();
