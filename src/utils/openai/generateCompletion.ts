import { getOpenAiSingleton } from "./getOpenAiSingleton";

interface GenerateCompletionParams {
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
  isMock?: boolean;
}

export async function generateCompletion(params: GenerateCompletionParams): Promise<string> {
  const {
    messages,
    prompt,
    maxTokens = 1000,
    temperature = 0,
    model = 'gpt-4o',
    isMock = false,
  } = params;

  if (isMock) {
    return 'This is a placeholder response for mock mode.';
  }

  const openai = await getOpenAiSingleton();

  try {
    let response;
    if (messages && messages.length > 0) {
      response = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      });
      return response.choices?.[0]?.message?.content?.trim() || '';
    } else if (prompt) {
      response = await openai.completions.create({
        model,
        prompt,
        max_tokens: maxTokens,
        temperature,
      });
      return response.choices[0].text?.trim() || '';
    } else {
      throw new Error('Either messages or prompt must be provided.');
    }
  } catch (error) {
    console.error('Error generating completion:', error);
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    } else {
      return 'Error: Unknown error occurred during completion generation.';
    }
  }
}
