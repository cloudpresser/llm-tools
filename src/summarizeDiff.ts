import OpenAI from 'openai';
import { getConfig } from './config';



const BATCH_SIZE = 7500; // Characters per batch
const MAX_PARALLEL_REQUESTS = 3; // Maximum number of parallel requests

export async function summarizeDiff(diff: string): Promise<string> {

  const config = await getConfig();
  config.debug && console.log('Received diff in summarizeDiff:', diff);

  if (!diff) {
    console.log('Empty diff received in summarizeDiff');
    return 'No changes detected or empty diff provided.';
  }

  if (typeof diff !== 'string') {
    console.error('Invalid diff type:', typeof diff);
    return 'Error: Invalid diff format';
  }

  const batches = splitIntoBatches(diff, BATCH_SIZE);
  const summaries = await processBatchesInParallel(batches);
  return await combineSummaries(summaries);
}

function splitIntoBatches(diff: string, batchSize: number): string[] {
  const batches = [];
  for (let i = 0; i < diff.length; i += batchSize) {
    batches.push(diff.slice(i, i + batchSize));
  }
  return batches;
}

async function processBatchesInParallel(batches: string[]): Promise<string[]> {
  const summaries: string[] = [];
  for (let i = 0; i < batches.length; i += MAX_PARALLEL_REQUESTS) {
    const batchPromises = batches.slice(i, i + MAX_PARALLEL_REQUESTS).map(processBatch);
    const batchSummaries = await Promise.all(batchPromises);
    summaries.push(...batchSummaries);
  }
  return summaries;
}

let openai: OpenAI | null = null;

const getOpenAiSingleton = async () => {
  if (!openai) {
    const config = await getConfig();
    openai = new OpenAI({
      apiKey: config.openaiApiKey,
    });
  }
  return openai as OpenAI;
}

async function processBatch(batchDiff: string): Promise<string> {
  const openai = await getOpenAiSingleton();
  
  const prompt = `
Analyze the following part of a git diff and provide a concise summary. Focus on:

1. Files changed: List all files that were modified, added, or deleted.
2. For each file, describe the key changes:
   - For added/deleted files, mention their purpose.
   - For modified files, explain what functionality was altered.
3. Highlight any significant code changes, such as:
   - New functions or methods added
   - Major changes to existing functions
   - Changes in data structures or algorithms
4. Note any changes to dependencies or configuration files.
5. Mention any changes related to performance improvements or optimizations.
6. Point out any changes in error handling or logging.
7. Identify any changes related to security (if applicable).

IMPORTANT: Omit unused or unnaplicable headers (Do not list 7 if it's empty)

Git Diff Part:
${batchDiff}

Concise Summary:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant that summarizes git diffs." },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const summary = response.choices[0].message.content?.trim() || 'Unable to generate summary.';
    console.log('Generated batch summary:', summary);
    return summary;
  } catch (error) {
    console.error('Error generating batch summary:', error);
    if (error instanceof Error) {
      return `Error generating batch summary: ${error.message}`;
    } else {
      return 'Error generating batch summary: Unknown error';
    }
  }
}

async function combineSummaries(summaries: string[]): Promise<string> {
  const combinedSummary = summaries.join('\n\n');
  const finalPrompt = `
Combine and summarize the following batch summaries into a cohesive overall summary:

${combinedSummary}

Overall Summary:`;

  return processBatch(finalPrompt);
}
