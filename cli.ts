#!/usr/bin/env ts-node

import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import { createConfiguredTable } from './src/createConfiguredTable';
import dotenv from 'dotenv';
import ora from 'ora';
import chalk from 'chalk';
import { getCurrentBranch } from './src/getCurrentBranch';
import { getGitDiff } from './src/getGitDiff';
import { readPRTemplate } from './src/readPRTemplate';
import { generateWithAI } from './src/generateWithAI';
import { generatePRDescription } from './src/generatePRDescription';

dotenv.config();

async function main() {
  console.log(chalk.blue('Environment variables:'));
  const envVars: [string, string][] = [
    ['ORGANIZATION', process.env.ORGANIZATION || 'Not set'],
    ['PROJECT', process.env.PROJECT || 'Not set'],
    ['REPOSITORY_ID', process.env.REPOSITORY_ID || 'Not set'],
    ['PERSONAL_ACCESS_TOKEN', process.env.PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : 'Not set'],
  ];
  console.log(createConfiguredTable(envVars));

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
    .option('dryRun', {
      type: 'boolean',
      description: 'Run the script in dry-run mode (no actual request to Azure DevOps)',
      default: false,
    })
    .parse();

  if (!process.env.PERSONAL_ACCESS_TOKEN && !argv.personalAccessToken) {
    throw new Error('Error: Personal Access Token is not set in the .env file or provided as an argument.');
  }

  console.log(chalk.blue('Evaluated CLI arguments:'));
  const cliArgs: [string, string][] = [
    ['ORGANIZATION', argv.organization || 'Not set'],
    ['PROJECT', argv.project || 'Not set'],
    ['REPOSITORY_ID', argv.repositoryId || 'Not set'],
    ['TITLE', argv.title],
    ['DESCRIPTION', argv.description],
    ['PERSONAL_ACCESS_TOKEN', argv.personalAccessToken ? '[REDACTED]' : 'Not set'],
  ];
  console.log(createConfiguredTable(cliArgs));


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

  let pullRequestId = 'dry-run-id';
  if (argv.dryRun) {
    console.log(chalk.yellow('Dry-run mode enabled. No actual request to Azure DevOps will be made.'));
  } else {
    pullRequestId = await createPullRequest({
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
  }

  if (!argv.organization || !argv.project || !argv.repositoryId) {
    console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
  }

  const prDetails: [string, string][] = [
    ['Pull Request ID', pullRequestId],
    ['Title', argv.title],
    ['Source Branch', sourceBranch],
    ['Target Branch', targetBranch],
    ['Description', argv.description],
    ['View PR', `https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`],
  ];

  if (argv.dryRun) {
    console.log(chalk.blue('Dry-run mode: Pull request details:'));
  } else {
    console.log(chalk.blue('Pull request created successfully:'));
  }
  console.log(createConfiguredTable(prDetails));
}

main().catch((error) => {
  console.log(chalk.red('Unhandled error in main:'), error);
});
