import OpenAI from 'openai';
import { loadEnv } from './loadEnv';

const env = loadEnv();
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function generateWithAI(prompt: string, gitDiff: string, isSummary: boolean ,isMock: boolean): Promise<string> {
  if (isMock) {
    return "This is a placeholder response for mock mode.";
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in the environment');
  }


  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are an AI assistant helping with pull request reviews." },
      { role: "user", content: `${prompt}\n\nGit Diff Summary:\n${gitDiff}` }
    ],
    max_tokens: 1000,
    temperature: 0.7,
  });

  return response.choices[0].message?.content || '';
}
