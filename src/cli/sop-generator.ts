#!/usr/bin/env ts-node

import { Command } from 'commander';
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { z } from "zod";
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import * as lancedb from "@lancedb/lancedb";

// Initialize OpenAI client
const oai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? undefined,
  organization: process.env.OPENAI_ORG_ID ?? undefined
});

// Initialize Instructor client
const client = Instructor({
  client: oai,
  mode: "TOOLS"
});

// Define schema for parameters
const SOPSchema = z.object({
  title: z.string().describe("The title of the SOP"),
  description: z.string().describe("A brief description of the SOP"),
  businessSystem: z.string().describe("The name of the business system relevant to the SOP"),
  businessContext: z.string().optional().describe("Additional business context relevant to the SOP"),
  keyProcesses: z.array(z.string()).describe("Key processes involved in the SOP"),
  outputPath: z.string().describe("The directory path where the SOP will be saved")
});

// Get default database path
const getDefaultDBPath = () => {
  const xdgConfigPath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfigPath, "sop-generator", "vector-db");
};

// Function to initialize LanceDB and create/load table
async function initializeDatabase(dbPath: string) {
  const db = await lancedb.connect(dbPath);
  let table;
  try {
    table = await db.openTable("vectors");
  } catch {
    // Define schema for the vectors table with sample data
    const sampleData = [{
      vector: [],  // Empty vector as placeholder
      content: "",
      fileName: ""
    }];
    table = await db.createTable("vectors", sampleData, { mode: "overwrite" });
  }
  return table;
}

// Function to build vector database if knowledge base is provided
async function buildVectorDatabase(table: any, kbPath: string) {
  console.log("Building vector database from knowledge base...");
  const files = fs.readdirSync(kbPath).filter(file => file.endsWith(".md"));
  const vectors = [];

  for (const file of files) {
    const filePath = path.join(kbPath, file);
    const content = fs.readFileSync(filePath, "utf8");

    const embedding = await client.embeddings.create({
      input: content,
      model: "text-embedding-3-large"
    });

    vectors.push({
      vector: embedding.embeddings,
      content,
      fileName: file
    });
  }

  await table.add(vectors);
}

// Function to retrieve relevant documents using LanceDB
async function retrieveRelevantDocs(query: string, table: any) {
  const queryEmbedding = await client.embeddings.create({
    input: query,
    model: "text-embedding-3-large"
  });

  const results = await table.vectorSearch(queryEmbedding.embeddings).limit(5).toArray();
  return results.map(row => row.content);
}


// Function to generate the AI-optimized prompt
async function createPrompt(params: z.infer<typeof SOPSchema>, relevantDocs?: string[]) {
  const combinedContext = relevantDocs?.join("\n\n") || "No additional context provided.";

  return `
<prompt>
  <objective>Create a detailed Standard Operating Procedure</objective>
  <context>
    <company>Cloudpresser LLC</company>
    <focus>Standardization, Scalability, AI Integration</focus>
    <description>${params.description}</description>
    <businessSystem>${params.businessSystem}</businessSystem>
    <businessContext>${params.businessContext || "None provided"}</businessContext>
    <keyProcesses>
      ${params.keyProcesses.map(process => `<process>${process}</process>`).join("\n      ")}
    </keyProcesses>
    <relevantDocumentation>
      ${combinedContext}
    </relevantDocumentation>
  </context>
  <sections>
    <section name="Purpose" />
    <section name="Scope" />
    <section name="Roles and Responsibilities" />
    <section name="Procedure">
      <subsection name="Step 1: [Step Name]" />
      <subsection name="Step 2: [Step Name]" />
    </section>
    <section name="Templates" />
    <section name="KPIs" />
    <section name="Approval" />
  </sections>
  <requirements>
    <format>Professional, Clear, Concise</format>
    <style>Standardized Template</style>
  </requirements>
</prompt>`;
}

// Function to generate SOP
async function generateSOP(params: z.infer<typeof SOPSchema>, kbPath: string | undefined, dbPath: string) {
  try {
    const table = await initializeDatabase(dbPath);

    let relevantDocs;
    if (kbPath) {
      console.log("Building database from knowledge base...");
      await buildVectorDatabase(table, kbPath);
      console.log("Retrieving relevant documents...");
      relevantDocs = await retrieveRelevantDocs(`${params.businessSystem} ${params.keyProcesses.join(" ")}`, table);
    }

    console.log("Generating AI prompt...");
    const prompt = await createPrompt(params, relevantDocs);

    console.log("Requesting AI-generated content...");
    const aiResponse = await client.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "o1-preview"
    });

    const finalSOP = aiResponse.choices[0].message.content;

    const outputFile = path.resolve(params.outputPath, `${params.title.replace(/\s+/g, '_')}_SOP.md`);
    fs.writeFileSync(outputFile, finalSOP);

    console.log(`SOP created successfully: ${outputFile}`);
  } catch (error) {
    console.error("Error generating SOP:", error);
  }
}

const program = new Command();

program
  .name("sop-generator")
  .description("CLI tool to generate SOPs using LanceDB and AI-driven content generation")
  .version("1.0.0")
  .requiredOption("-t, --title <title>", "Title of the SOP")
  .requiredOption("-d, --description <description>", "Description of the SOP")
  .requiredOption("-b, --businessSystem <businessSystem>", "Name of the business system")
  .requiredOption("-k, --keyProcesses <keyProcesses...>", "Key processes involved in the SOP")
  .option("-c, --businessContext <businessContext>", "Additional business context")
  .option("-kb, --knowledgeBase <path>", "Path to the knowledge base directory")
  .option("-db, --database <path>", "Path to the local vector database directory", getDefaultDBPath())
  .option("-o, --output <path>", "Output directory", "./")
  .action(async (options) => {
    const params = SOPSchema.parse({
      title: options.title,
      description: options.description,
      businessSystem: options.businessSystem,
      businessContext: options.businessContext,
      keyProcesses: options.keyProcesses,
      outputPath: options.output
    });

    await generateSOP(params, options.knowledgeBase, options.database);
  });

program.parse(process.argv);
