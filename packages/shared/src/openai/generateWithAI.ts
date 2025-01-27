import { generateCompletion } from '../openai';
import { getConfig } from '../config';



export async function generateWithAI(prompt: string, gitDiff: string, isSummary: boolean, isMock: boolean): Promise<string> {
  const config = await getConfig();

  const messages = [
    {
      role: 'system',
      content: 'You are an AI assistant helping with pull request reviews.',
    },
    {
      role: 'user',
      content: `User Story/Work Item context: ${config.userPrompt}`,
    },
    {
      role: 'user',
      content: `Based on the above context, ${prompt}`,
    },
    {
      role: 'user',
      content: `Git Diff Summary:\n${gitDiff}`,
    },
  ];

  try {
    const completion = await generateCompletion({ messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, isMock });
    if (config.debug) {
      console.log('Generated AI response:', completion);
    }
    return completion;
  } catch (error) {
    console.error('Error generating AI response:', error);
    if (error instanceof Error) {
      return `Error generating AI response: ${error.message}`;
    } else {
      return 'Error generating AI response: Unknown error';
    }
  }
}
