#!/usr/bin/env ts-node

import { Command } from 'commander';
import { SOPSchema } from '../utils/sop/types';
import { generateSOP } from '../utils/sop/generator';
import { initializeAIClients, getDefaultDBPath } from '../utils/sop/shared';

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

    const client = initializeAIClients();
    await generateSOP(params, options.knowledgeBase, options.database, client);
  });

program.parse(process.argv);
