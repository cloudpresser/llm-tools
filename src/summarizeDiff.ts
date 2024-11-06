import { generateCompletion } from './utils/openai';
import { getConfig } from './config';



const BATCH_SIZE = 8000; // Characters per batch
const MAX_PARALLEL_REQUESTS = 20; // Maximum number of parallel requests

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

const getGitLog = async () => {
  return ''
}

const getContext = async () => {
  const config = await getConfig();


  const gitLog = await getGitLog();

  const context = `You are an assistant that is helping a software engineer write a Pull Request message to be reviewed by another engineer.

The PR was described by the user as: ${config.userPrompt}

The latests commits in the PR are:
${gitLog}
`
  return context
}

async function processBatch(batchDiff: string): Promise<string> {

  const context = await getContext();

  const prompt = `${context}
Your job is to analyze the following part of a git diff and provide a concise summary.

Git Diff Part:
${batchDiff}

Focus on:
1. Files changed: List all files that were modified, added, or deleted.
2. Key changes: For each file, describe the key changes:
   - For added/deleted files, mention their purpose.
   - For modified files, explain what functionality was altered.
3. Significant changes: Highlight any significant code changes, such as:
   - New functions or methods added
   - Major changes to existing functions
   - Changes in data structures or algorithms
4. Dependencies: Note any changes to dependencies or configuration files.
5. Performance: Mention any changes related to performance improvements or optimizations.
6. Error Handling: Point out any changes in error handling or logging.
7. Security: Identify any changes related to security (if applicable).
8. RefactorsIdentify any refactors.

IMPORTANT: Omit unused or unnaplicable headers (Do not list 7 if it's empty)

Example:
1. Files changed:
'index.js'
'package.json'
2. Key changes
index.js was refactored to be more in line with the current architecture
package.json had a new package added
3. Significant changes
indext.js had it's structure changed
4. Dependencies
next, a react full stack framework was added as a dependency
8. Refactors
index.js wa refactored

Concise Summary:`;
  const config = await getConfig();
  const messages = [
    {
      role: 'system' as const,
      content: context,
    },
    {
      role: 'user' as const,
      content: prompt,
    },
  ];

  try {
    const completion = await generateCompletion({ messages: messages });
    if (config.debug) {
      console.log('Generated diff summary:', completion);
    }
    return completion;
  } catch (error) {
    console.error('Error generating diff summary:', error);
    if (error instanceof Error) {
      return `Error generating diff summary: ${error.message}`;
    } else {
      return 'Error generating diff summary: Unknown error';
    }
  }
}

async function combineSummaries(summaries: string[]): Promise<string> {
  const combinedSummary = summaries.join('\n\n');
  const finalPrompt = `
Combine and summarize the following batch summaries into a cohesive overall summary:

${combinedSummary}

Overall Summary:`;

  const config = await getConfig();
  const messages = [
    {
      role: 'system' as const,
      content: 'You are an AI assistant helping with pull request reviews.',
    },
    {
      role: 'user' as const,
      content: finalPrompt,
    },
  ];

  try {
    const completion = await generateCompletion({ messages: messages });
    if (config.debug) {
      console.log('Generated combined summary:', completion);
    }
    return completion;
  } catch (error) {
    console.error('Error generating combined summary:', error);
    if (error instanceof Error) {
      return `Error generating combined summary: ${error.message}`;
    } else {
      return 'Error generating combined summary: Unknown error';
    }
  }
}
