import { SOPParams } from './types';
import { buildVectorDatabase, searchKnowledgeBase, retrieveRelevantDocs } from './database';
import { createPrompt } from './prompt';
import { generateSOPContent, formatSOPContent } from './aiCompletion';
import { tavily } from '@tavily/core';
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from "openai";

export async function generateSOP(params: SOPParams, kbPath: string | undefined, dbPath: string, client: OpenAI): Promise<string> {
  try {
    let relevantDocs;
    let webSearchResults;
    if (kbPath) {
      console.log("Building database from knowledge base...");
      await buildVectorDatabase(kbPath, dbPath, client);
      console.log("Retrieving relevant documents...");
      relevantDocs = await searchKnowledgeBase(
        `${params.businessSystem} ${params.keyProcesses.join(" ")}`,
        dbPath,
        kbPath,
        client
      );
    }

    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (tavilyApiKey) {
      console.log("Performing web search using Tavily...");
      const tavilyClient = tavily({ apiKey: tavilyApiKey });
      const query = `Information, tools, context, and best practices for ${params.businessSystem} ${params.keyProcesses.join(' ')}`;
      webSearchResults = await tavilyClient.searchContext(query, {
        searchDepth: "advanced",
        maxTokens: 8000
      });
    }

    console.log("Generating AI prompt...");
    const prompt = await createPrompt(params, relevantDocs, webSearchResults);

    console.log("Requesting AI-generated content...");
    const sopContent = await generateSOPContent(client, prompt);
    const processedSOP = formatSOPContent(sopContent);

    const outputFile = path.resolve(params.outputPath, `${params.title.replace(/\s+/g, '_')}_SOP.md`);
    fs.writeFileSync(outputFile, processedSOP);

    console.log(`SOP created successfully: ${outputFile}`);
    return processedSOP;
  } catch (error) {
    console.error("Error generating SOP:", error);
    throw error;
  }
}
