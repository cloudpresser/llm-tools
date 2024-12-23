import fs from 'fs/promises';
import path from 'path';
import { client } from './shared';
import { createPrompt } from './prompt';
import { searchKnowledgeBase } from './database';
import { tavily } from '@tavily/core';
import { generateSOPContent, formatSOPContent } from './aiCompletion';

interface ImproveSopParams {
  sopPath: string;
  message: string;
  targetPortion?: string;
  knowledgeBasePath?: string;
  databasePath: string;
  outputPath?: string;
  client: import('openai').OpenAI;
}

interface ImproveSopResult {
  outputPath: string;
  backupPath?: string;
  wasBackupCreated: boolean;
}

export async function improveSOP(params: ImproveSopParams): Promise<ImproveSopResult | undefined> {
  // Validate input params
  if (!params.sopPath) {
    throw new Error('SOP path is required');
  }
  if (!params.message) {
    throw new Error('Improvement message is required');
  }
  if (!params.databasePath) {
    throw new Error('Database path is required');
  }
  // Read the original SOP
  let originalSOP: string;
  try {
    originalSOP = await fs.readFile(params.sopPath, 'utf-8');
    if (!originalSOP.trim()) {
      throw new Error('SOP file is empty');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read SOP file: ${error.message}`);
    }
    throw error;
  }

  // Get relevant context from knowledge base if path provided
  let relevantDocs: string[] = [];
  let webSearchResults;
  
  if (params.knowledgeBasePath) {
    try {
      relevantDocs = await searchKnowledgeBase(
        params.message,
        params.databasePath,
        params.knowledgeBasePath,
        params.client
      );
    } catch (error) {
      console.warn('Failed to search knowledge base:', error);
      // Continue without knowledge base results
    }
  }

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  if (tavilyApiKey) {
    try {
      console.log("Performing web search using Tavily...");
      const tavilyClient = tavily({ apiKey: tavilyApiKey });
      webSearchResults = await tavilyClient.searchContext(params.message, {
        searchDepth: "advanced",
        maxTokens: 8000
      });
    } catch (error) {
      console.warn('Failed to get web search results:', error);
      // Continue without web search results
    }
  }

  // Create improvement prompt
  const prompt = await createPrompt({
    type: 'improve',
    originalContent: originalSOP,
    message: params.message,
    targetPortion: params.targetPortion,
    title: '',
    description: '',
    businessSystem: '',
    keyProcesses: [],
    outputPath: ''
  }, relevantDocs, webSearchResults);

  try {
    const improvedContent = await generateSOPContent(params.client, prompt);
    console.log(improvedContent);

    const finalContent = formatSOPContent(improvedContent);

      const outputPath = params.outputPath || params.sopPath;
      let backupPath: string | undefined;
      let wasBackupCreated = false;

      try {
        // Create backup of original file if we're overwriting it
        if (outputPath === params.sopPath) {
          backupPath = `${params.sopPath}.bak`;
          await fs.copyFile(params.sopPath, backupPath);
          wasBackupCreated = true;
        }

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // Write improved SOP
        await fs.writeFile(outputPath, finalContent);

        return {
          outputPath,
          backupPath,
          wasBackupCreated
        };
      } catch (error) {
        // If writing fails and we created a backup, try to restore it
        if (wasBackupCreated && backupPath) {
          try {
            await fs.copyFile(backupPath, params.sopPath);
          } catch (restoreError) {
            console.error('Failed to restore backup:', restoreError);
          }
        }

        if (error instanceof Error) {
          throw new Error(`Failed to write improved SOP: ${error.message}`);
        }
        throw error;
      }
  } catch (e: any) {
    // Handle edge cases
    if (e.constructor.name === "LengthFinishReasonError") {
      console.log("Too many tokens: ", e.message);
    } else {
      console.log("An error occurred: ", e.message);
    }
    throw e;
  }
}
