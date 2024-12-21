import { SOPParams } from './types';
import { initializeDatabase, buildVectorDatabase, retrieveRelevantDocs } from './database';
import { createPrompt } from './prompt';
import { tavily } from '@tavily/core';
import * as fs from 'fs';
import * as path from 'path';
import { Instructor } from "@instructor-ai/instructor";

export async function generateSOP(params: SOPParams, kbPath: string | undefined, dbPath: string, client: Instructor): Promise<string> {
  try {
    const table = await initializeDatabase(dbPath);

    let relevantDocs;
    let webSearchResults;
    if (kbPath) {
      console.log("Building database from knowledge base...");
      await buildVectorDatabase(table, kbPath, client);
      console.log("Retrieving relevant documents...");
      relevantDocs = await retrieveRelevantDocs(`${params.businessSystem} ${params.keyProcesses.join(" ")}`, table, client);
    }

    const tavilyApiKey = process.env.TAVILY_API_KEY;

    if (tavilyApiKey) {
      console.log("Performing web search using Tavily...");
      const tavilyClient = tavily({ apiKey: tavilyApiKey });
      const query = `Information, tools, context, and best practices for ${params.businessSystem} ${params.keyProcesses.join(' ')}`;
      webSearchResults = await tavilyClient.searchContext(query);
    }

    console.log("Generating AI prompt...");
    const prompt = await createPrompt(params, relevantDocs, webSearchResults);

    console.log("Requesting AI-generated content...");
    const aiResponse = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4"
    });

    const finalSOP = aiResponse.choices[0].message.content;

    const outputFile = path.resolve(params.outputPath, `${params.title.replace(/\s+/g, '_')}_SOP.md`);
    fs.writeFileSync(outputFile, finalSOP);

    console.log(`SOP created successfully: ${outputFile}`);
    return finalSOP;
  } catch (error) {
    console.error("Error generating SOP:", error);
    throw error;
  }
}
