#!/usr/bin/env ts-node

import { Command } from 'commander';
import { initializeAIClients, getDefaultDBPath } from '../utils/sop/shared';
import { improveSOP } from '../utils/sop/improver';

const program = new Command();

program
  .name("sop-improver")
  .description("CLI tool to improve existing SOPs using AI and context")
  .version("1.0.0")
  .requiredOption("-s, --sop <path>", "Path to the source SOP file")
  .requiredOption("-m, --message <message>", "Improvement message or instructions")
  .option("-t, --targetSection <section>", "Specific section to target (purpose, scope, rolesAndResponsibilities, procedure)")
  .option("-kb, --knowledgeBase <path>", "Path to the knowledge base directory")
  .option("-db, --database <path>", "Path to the local vector database directory", getDefaultDBPath())
  .option("-o, --output <path>", "Output path for improved SOP", "./improved-sop.md")
  .action(async (options) => {
    try {
      const client = initializeAIClients();

      console.log("Improving SOP based on provided message...");
      const improvedSOPPath = await improveSOP({
        sopPath: options.sop,
        message: options.message,
        targetSection: options.targetSection,
        knowledgeBasePath: options.knowledgeBase,
        databasePath: options.database,
        outputPath: options.output,
        client
      });

      console.log(`Improved SOP saved to: ${improvedSOPPath?.outputPath}`);
    } catch (error) {
      console.error("Error:", error);
      process.exit(1);
    }
  });

program.parse(process.argv);
