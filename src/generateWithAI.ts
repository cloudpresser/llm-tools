import OpenAI from 'openai';
import { getConfig } from './config';



export async function generateWithAI(prompt: string, gitDiff: string, isSummary: boolean, isMock: boolean): Promise<string> {
  const config = await getConfig();
  const openai = new OpenAI({
    apiKey: config.openaiApiKey,
  });
  if (isMock) {
    return "This is a placeholder response for mock mode.";
  }

  const openaiApiKey = config.openaiApiKey;
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set in the configuration');
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
