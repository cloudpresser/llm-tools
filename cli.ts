#!/usr/bin/env ts-node

import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { getCurrentBranch } from './src/getCurrentBranch';
import { getGitDiff } from './src/getGitDiff';
import { readPRTemplate } from './src/readPRTemplate';
import { generateWithAI } from './src/generateWithAI';
import { generatePRDescription } from './src/generatePRDescription';

dotenv.config();

async function main() {
  console.log(chalk.blue('Environment variables:'));
  console.log(chalk.green('ORGANIZATION:'), process.env.ORGANIZATION || 'Not set');
  console.log(chalk.green('PROJECT:'), process.env.PROJECT || 'Not set');
  console.log(chalk.green('REPOSITORY_ID:'), process.env.REPOSITORY_ID || 'Not set');
  console.log(chalk.green('PERSONAL_ACCESS_TOKEN:'), process.env.PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : 'Not set');

  const argv = await yargs(process.argv.slice(2))
    .option('organization', {
      type: 'string',
      description: 'Azure DevOps organization name',
      default: process.env.ORGANIZATION,
    })
    .option('project', {
      type: 'string',
      description: 'Project name',
      default: process.env.PROJECT,
    })
    .option('repositoryId', {
      type: 'string',
      description: 'Repository ID',
      default: process.env.REPOSITORY_ID,
    })
    .option('title', {
      type: 'string',
      description: 'Pull request title',
      demandOption: true,
    })
    .option('description', {
      type: 'string',
      description: 'Pull request description',
      demandOption: true,
    })
    .option('personalAccessToken', {
      type: 'string',
      description: 'Azure DevOps personal access token',
      default: process.env.PERSONAL_ACCESS_TOKEN,
    })
    .parse();

  if (!process.env.PERSONAL_ACCESS_TOKEN && !argv.personalAccessToken) {
    throw new Error('Error: Personal Access Token is not set in the .env file or provided as an argument.');
  }

  console.log(chalk.blue('Evaluated CLI arguments:'));
  console.log(chalk.green('ORGANIZATION:'), argv.organization || 'Not set');
  console.log(chalk.green('PROJECT:'), argv.project || 'Not set');
  console.log(chalk.green('REPOSITORY_ID:'), argv.repositoryId || 'Not set');
  console.log(chalk.green('TITLE:'), argv.title);
  console.log(chalk.green('DESCRIPTION:'), argv.description);
  console.log(chalk.green('PERSONAL_ACCESS_TOKEN:'), argv.personalAccessToken ? '[REDACTED]' : 'Not set');

  const spinner = ora({
    text: chalk.blue('Fetching git diff...'),
    spinner: 'dots',
    color: 'cyan'
  }).start();
  const gitDiff = await getGitDiff();
  spinner.succeed(chalk.green('Git diff fetched.'));

  spinner.start(chalk.blue('Getting current branch...'));
  const sourceBranch = await getCurrentBranch();
  spinner.succeed(chalk.green('Current branch obtained.'));
  const defaultTargetBranch = 'main'; // Assuming 'main' is your default target branch
  const targetBranch = sourceBranch === defaultTargetBranch ? 'develop' : defaultTargetBranch;

  if (sourceBranch === targetBranch) {
    throw new Error('Source and target branches cannot be the same. Please make sure you are not on the main branch.');
  }

  if (!argv.title) {
    const titleSpinner = ora({
      text: chalk.blue('Generating pull request title...'),
      spinner: 'dots',
      color: 'cyan'
    }).start();
    argv.title = await generateWithAI("Generate a concise and descriptive pull request title based on the following git diff:", gitDiff, false);
    titleSpinner.succeed(chalk.green('Pull request title generated.'));
  }

  if (!argv.description) {
    const descriptionSpinner = ora({
      text: chalk.blue('Generating pull request description...'),
      spinner: 'dots',
      color: 'cyan'
    }).start();
    const prTemplate = await readPRTemplate(path.dirname(__filename));
    argv.description = await generatePRDescription(gitDiff, prTemplate, false);
    descriptionSpinner.succeed(chalk.green('Pull request description generated.'));
  }

  const pullRequestId = await createPullRequest({
    organization: argv.organization || '',
    project: argv.project || '',
    repositoryId: argv.repositoryId || '',
    title: argv.title,
    description: argv.description,
    workItems: [],
    targetBranch: targetBranch,
    sourceBranch: sourceBranch,
    personalAccessToken: argv.personalAccessToken || '',
  });

  if (!argv.organization || !argv.project || !argv.repositoryId) {
    console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
  }

  console.log(chalk.blue('Pull request created successfully:'));
  console.log(chalk.green(`Pull Request ID: ${pullRequestId}`));
  console.log(chalk.green(`Title: ${argv.title}`));
  console.log(chalk.green(`Source Branch: ${sourceBranch}`));
  console.log(chalk.green(`Target Branch: ${targetBranch}`));
  console.log(chalk.green(`Description: ${argv.description}`));
  console.log(chalk.green(`View PR: https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`));
}

main().catch((error) => {
  console.log(chalk.red('Unhandled error in main:'), error);
});
