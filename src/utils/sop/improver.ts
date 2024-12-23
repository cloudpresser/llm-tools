import fs from 'fs/promises';
import path from 'path';
import { client } from './shared';
import { createPrompt } from './prompt';
import { searchKnowledgeBase } from './database';
import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";

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
  if (params.knowledgeBasePath) {
    try {
      relevantDocs = await searchKnowledgeBase(
        params.message,
        params.knowledgeBasePath,
        params.databasePath,
        params.client
      );
    } catch (error) {
      console.warn('Failed to search knowledge base:', error);
      // Continue without knowledge base results
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
  }, relevantDocs);

  // Generate improved content
  const functionSchema = z.object({
    purpose: z.string().describe("The purpose of the SOP, in Markdown format, starting with a level 2 heading (##)"),
    scope: z.string().describe("The scope of the SOP, in Markdown format, starting with a level 2 heading (##)"),
    rolesAndResponsibilities: z.string().describe("The roles and responsibilities section of the SOP, in Markdown format, starting with a level 2 heading (##)"),
    procedure: z.string().describe("The procedure section of the SOP, in Markdown format, starting with a level 2 heading (##), each subsection starting with a level 3 heading (###)"),
    kpis: z.string().describe("The KPIs section of the SOP, in Markdown format, starting with a level 2 heading (##)"),
    documentReferences: z.array(z.object({
      title: z.string().optional().describe("The name of the document or template referenced"),
      type: z.union([
        z.literal('document'),
        z.literal('template'),
        z.literal('SOP'),
        z.literal('policy'),
        z.literal('checklist'),
        z.literal('flowchart'),
        z.literal('diagram'),
        z.literal('image'),
      ]).optional().describe("The type of the document or template referenced"),
      link: z.string().optional().describe("The URL or path to the document or template"),
      description: z.string().optional().describe("A description of the document or template referenced"),
    }).describe("A document or template reference")).describe("A list of document or template references, each containing a title, type, and link"),
  });

  try {

    const completion = await params.client.beta.chat.completions.parse({
      messages: [{ role: 'user', content: prompt }],
      model: "gpt-4o-2024-08-06",
      response_format: zodResponseFormat(functionSchema, 'improved_sop'),
    });


    const improvedContentResponse = completion.choices[0].message;

    const improvedContent = improvedContentResponse.parsed;

    if (!improvedContent) {
      throw new Error('No content received from AI');
    }

    console.log(improvedContentResponse);

    if (improvedContent) {
      console.log(improvedContent);

      // Build document references section
      const documentReferences = [
        `### Documents

  Documents, checklists, images, diagrams, flowcharts, SOPs, policies, ...`,
        improvedContent.documentReferences.map((ref: any) => {
          return `### ${ref.title} \n  - [Link](${ref.link}) \n  - ${ref.description} \n - Type: ${ref.type}`;
        }).join('\n')]

      // Combine all sections into final markdown
      const finalContent = [
        improvedContent.purpose,
        improvedContent.scope,
        improvedContent.rolesAndResponsibilities,
        improvedContent.procedure,
        improvedContent.kpis,
        documentReferences.join('\n')
      ].join('\n\n');

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
    } else if (improvedContentResponse.refusal) {
      // handle refusal
      console.log(improvedContentResponse.refusal);
    }

  } catch (e: any) {
    // Handle edge cases
    if (e.constructor.name == "LengthFinishReasonError") {
      // Retry with a higher max tokens
      console.log("Too many tokens: ", e.message);
    } else {
      // Handle other exceptions
      console.log("An error occurred: ", e.message);
    }
    throw e; // Re-throw to satisfy return type
  }
}
