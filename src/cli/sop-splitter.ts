#!/usr/bin/env ts-node

import { Command } from 'commander';
import { SOPSchema } from '../utils/sop/types';
import { identifySubProcesses, generateSubProcessSOPs } from '../utils/sop/splitter';
import { initializeAIClients, getDefaultDBPath } from '../utils/sop/shared';

const program = new Command();

program
  .name("sop-splitter")
  .description("CLI tool to split SOPs into sub-process SOPs")
  .version("1.0.0")
  .requiredOption("-s, --sop <path>", "Path to the source SOP file")
  .option("-t, --title <title>", "Base title for the generated SOPs", "AI Chatbot Creation")
  .option("-d, --description <description>", "Base description for the generated SOPs", "AI Chatbot Creation SOP")
  .requiredOption("-b, --businessSystem <businessSystem>", "Name of the business system")
  .option("-c, --businessContext <businessContext>", "Additional business context")
  .option("-kb, --knowledgeBase <path>", "Path to the knowledge base directory")
  .option("-db, --database <path>", "Path to the local vector database directory", getDefaultDBPath())
  .option("-o, --output <path>", "Output directory", "./")
  .action(async (options) => {
    try {
      const client = initializeAIClients();

      const baseParams = SOPSchema.parse({
        title: options.title,
        description: options.description,
        businessSystem: options.businessSystem,
        businessContext: options.businessContext,
        keyProcesses: [],
        outputPath: options.output
      });

      console.log("Identifying sub-processes...");
      const subProcesses = await identifySubProcesses(options.sop, client);

      console.log("Identified sub-processes:", subProcesses);

      console.log("Generating individual SOPs for each sub-process...");
      const generatedPaths = await generateSubProcessSOPs(
        baseParams,
        subProcesses,
        options.knowledgeBase,
        options.database,
        client
      );

      console.log("Generated SOPs:", generatedPaths);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
