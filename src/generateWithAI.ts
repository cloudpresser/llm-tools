import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateWithAI(prompt: string, gitDiff: string, isMock: boolean): Promise<string> {
  if (isMock) {
    return "This is a placeholder response for mock mode.";
  }

  // Limit git diff size
  const limitedGitDiff = gitDiff.length > 2000 ? gitDiff.substring(0, 2000) + "..." : gitDiff;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are an AI assistant helping with pull request reviews." },
      { role: "user", content: `${prompt}\n\nGit Diff:\n${limitedGitDiff}` }
    ],
  });

  return response.choices[0].message?.content || '';
}
