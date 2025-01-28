#!/usr/bin/env node
import readline from 'readline';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

import { createPullRequest } from './azureDevops';
import { readPRTemplate } from './readPRTemplate';
import { generatePRDescription } from './generatePRDescription';

import { getConfig } from '@cloudpresser/shared';
import { generateWithAI } from '@cloudpresser/shared';
import { getGitDiff } from '@cloudpresser/shared';
import { createConfiguredTable } from '@cloudpresser/shared';

const neonGreen = chalk.hex('#39FF14');
const neonOrange = chalk.hex('#FFA500');
const neonBlue = chalk.hex('#00FFFF');
const neonPink = chalk.hex('#FF00FF');

async function main() {
  console.log('Starting main function');
  const config = await getConfig();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(neonGreen('\nConfiguration:'));
  const configTable: [string, string][] = [
    ['ORGANIZATION', neonPink(config.organization || 'Not set')],
    ['PROJECT', neonPink(config.project || 'Not set')],
    ['REPOSITORY_ID', neonPink(config.repositoryId || 'Not set')],
    ['PERSONAL_ACCESS_TOKEN', neonPink((config.personalAccessToken || 'Not set').substring(0, 10) + '...')],
    ['OPENAI_API_KEY', neonPink((config.openaiApiKey || 'Not set').substring(0, 10) + '...')],
    ['SOURCE_BRANCH', neonPink(config.sourceBranch)],
    ['TARGET_BRANCH', neonPink(config.targetBranch)],
    ['WORK_ITEMS', neonPink(config.workItems.map(item => item.id).join(', ') || 'None')],
  ];
  console.log(createConfiguredTable(configTable));

  if (!config.personalAccessToken) {
    throw new Error('Error: Personal Access Token is not set in the .env file or provided as an argument.');
  }

  try {
    const spinner = ora({
      text: neonBlue('Fetching git diff...'),
      spinner: 'dots',
      color: 'cyan'
    }).start();
    const gitDiff = await getGitDiff();
    spinner.succeed(neonPink('Git diff fetched.'));
    console.log(gitDiff)
    // Add this log to check the git diff content
    console.log(neonGreen(`Git diff length: ${gitDiff.diff.length} characters`));

    if (config.sourceBranch === config.targetBranch) {
      throw new Error('Source and target branches cannot be the same. Please make sure you are not on the main branch.');
    }

    if (!config.title) {
      const titleSpinner = ora({
        text: neonBlue('Generating pull request title...'),
        spinner: 'dots',
        color: 'cyan'
      }).start();

      let titlePrompt;
      if (gitDiff.diff) {
        titlePrompt = 'Generate a concise and descriptive pull request title based on the following git diff:';
      } else if (gitDiff.summary.startsWith('Error:')) {
        titlePrompt = `Generate a generic pull request title. Note: ${gitDiff.summary}`;
      } else {
        titlePrompt = 'Generate a generic pull request title as no changes were detected.';
      }

      config.title = config.mock
        ? 'Mock Pull Request Title'
        : await generateWithAI(titlePrompt, gitDiff.summary || 'No changes detected', false, config.mock);
      titleSpinner.succeed(neonPink('Pull request title generated.'));
    }

    if (!config.description) {
      const descriptionSpinner = ora({
        text: neonBlue('Generating pull request description...'),
        spinner: 'dots',
        color: 'cyan'
      }).start();
      const prTemplate = await readPRTemplate();
      // Modify this part to handle empty gitDiff
      config.description = config.mock
        ? "This is a mock description for the pull request."
        : await generatePRDescription(gitDiff.summary || "No changes detected", prTemplate, true, config.mock);
      descriptionSpinner.succeed(neonPink('Pull request description generated.'));
    }


    // Function to check if a command is available
    function isCommandAvailable(command: string): boolean {
      try {
        execSync(`which ${command}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }

    // Function to open editor and get content
    async function openEditor(initialContent: string, filePrefix: string): Promise<string> {
      const spinner = ora('Opening editor...').start();
      const tempFile = path.join(process.cwd(), `${filePrefix}_temp.md`);
      await fs.writeFile(tempFile, initialContent);

      const editor = ['nvim', 'code', 'nano', 'vim'].find(isCommandAvailable);
      if (!editor) {
        console.log(neonOrange('No suitable editor found. Skipping manual edit.'));
        spinner.fail(neonOrange('Error while editing.'));
        return initialContent;
      }

      try {
        const editCommand = editor === 'code' ? `${editor} --wait ${tempFile}` : `${editor} ${tempFile}`;
        execSync(editCommand, { stdio: 'inherit' });
        const editedContent = await fs.readFile(tempFile, 'utf-8');
        await fs.unlink(tempFile);
        const result = editedContent.trim();
        spinner.succeed('Editor closed.');
        return result;
      } catch (error) {
        console.error(neonOrange('Error while editing:'), error);
        return initialContent;
      }
    }


    // Function to ask user if they want to edit
    async function askToEdit(prompt: string): Promise<boolean> {
      return new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question(prompt, (answer) => {
          rl.close();
          resolve(answer.toLowerCase() === 'y');
        });
      });
    }

    console.log(neonGreen('\nPull Request Details:'));
    const prDetailsEditTitle: [string, string][] = [
      ['Title', neonPink(config.title)],
      ['Source Branch', neonPink(config.sourceBranch)],
      ['Target Branch', neonPink(config.targetBranch)],
      ['Description', neonPink((config.description.length > 50 ? config.description.substring(0, 50) + '...' : config.description))],
    ];

    console.log(createConfiguredTable(prDetailsEditTitle));

    // Ask if user wants to edit title
    const editTitle = await askToEdit('Do you want to edit the pull request title? (y/n) ');
    if (editTitle) {
      config.title = await openEditor(config.title, 'pr_title');
    }

    console.log(neonGreen('\nUpdated Pull Request Details:'));

    const prDetailsEditDescription: [string, string][] = [
      ['Title', neonPink(config.title)],
      ['Source Branch', neonPink(config.sourceBranch)],
      ['Target Branch', neonPink(config.targetBranch)],
      ['Description', neonPink((config.description))],
    ];

    console.log(createConfiguredTable(prDetailsEditDescription));

    // Ask if user wants to edit description
    const editDescription = await askToEdit('Do you want to edit the pull request description? (y/n) ');
    if (editDescription) {
      config.description = await openEditor(config.description, 'pr_description');
    }


    let pullRequestId = 'Dry Run - No ID';
    if (config.dryRun) {
      console.log(neonGreen('Dry run mode enabled. No pull request will be created.'));
    } else {
      const confirm = await askToEdit('Do you want to create this pull request? (y/n) ');

      if (!confirm) {
        console.log(neonGreen('Pull request creation cancelled.'));
        rl.close();
        return;
      }

      console.log(neonGreen('Creating pull request...'));

      pullRequestId = await createPullRequest({
        organization: config.organization,
        project: config.project,
        repositoryId: config.repositoryId,
        title: config.title,
        description: config.description,
        workItems: config.workItems,
        targetBranch: config.targetBranch,
        sourceBranch: config.sourceBranch,
        personalAccessToken: config.personalAccessToken,
      }) as unknown as string;
      spinner.start('Creating pull request...');

      if (!config.organization || !config.project || !config.repositoryId) {
        console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
      }

      spinner.succeed(neonPink('Pull request created successfully.'));
    }

    const finalPrDetails: [string, string][] = [
      ['Title', neonPink(config.title)],
      ['Source Branch', neonPink(config.sourceBranch)],
      ['Target Branch', neonPink(config.targetBranch)],
      ['Description', neonPink(config.description)],
      ['Pull Request ID', neonPink(pullRequestId.toString())],
      ['View PR', config.dryRun ? neonBlue('Dry Run - No URL') : neonBlue(`https://dev.azure.com/${config.organization}/${config.project}/_git/${config.repositoryId}/pullrequest/${pullRequestId}`)],
    ];
    console.log(neonGreen('\nPull Request Created Successfully:'));
    console.log(createConfiguredTable(finalPrDetails));
    rl.close();
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(neonGreen('Error creating pull request:'), error.message);
      if (error.message.includes('Authentication failed')) {
        console.log('\nAuthentication Error Details:');
        console.log(neonGreen('1. Ensure your Personal Access Token is valid and has not expired.'));
        console.log(neonGreen('2. Verify that your Personal Access Token has the necessary scopes:'));
        console.log(neonGreen('   - Code (Read & Write)'));
        console.log(neonGreen('   - Pull Request Contribute'));
        console.log(neonGreen('3. Check if you can access the Azure DevOps web interface for this project.'));
        console.log(neonGreen('4. Try generating a new Personal Access Token and update the .env file.'));
      }
    } else {
      console.log(neonGreen('An unknown error occurred:'), error);
    }
    console.log(neonGreen('\nTroubleshooting steps:'));
    console.log(neonGreen('1. Double-check the organization, project, and repository details in your .env file.'));
    console.log(neonGreen('2. Ensure you have the necessary permissions in the Azure DevOps project.'));
    console.log(neonGreen('3. Check your network connection and try again.'));
    console.log(neonGreen('4. If the issue persists, try running the command with verbose logging:'));
    console.log(neonGreen('   DEBUG=axios npx ts-node cli.ts [your-options-here]'));
  }
}

main().catch((error) => {
  console.log(neonGreen('Unhandled error in main:'), error);
});
