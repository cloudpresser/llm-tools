#!/usr/bin/env ts-node

import yargs from 'yargs';
import path from 'path';
import { createPullRequest } from './src/utils/azureDevops/createPullRequest';
import { createConfiguredTable } from './src/createConfiguredTable';
import dotenv from 'dotenv';
import ora from 'ora';
import chalk from 'chalk';
import { getCurrentBranch } from './src/getCurrentBranch';
import { getGitDiff } from './src/getGitDiff';
import { readPRTemplate } from './src/readPRTemplate';
import { generateWithAI } from './src/generateWithAI';
import { generatePRDescription } from './src/generatePRDescription';
import { getConfig } from './src/config';

dotenv.config();

const neonGreen = chalk.hex('#39FF14');
const neonBlue = chalk.hex('#00FFFF');
const neonPink = chalk.hex('#FF00FF');



async function main() {
  console.log(neonGreen('\nConfiguration:'));
  const config = await getConfig();
  const configVars: [string, string][] = [
    ['ORGANIZATION', neonPink(config.organization || 'Not set')],
    ['PROJECT', neonPink(config.project || 'Not set')],
    ['REPOSITORY_ID', neonPink(config.repositoryId || 'Not set')],
    ['PERSONAL_ACCESS_TOKEN', neonPink((config.personalAccessToken || 'Not set').substring(0, 10) + '...')],
  ];
  console.log(createConfiguredTable(configVars));

  const argv = await yargs(process.argv.slice(2))
    .option('organization', {
      type: 'string',
      description: 'Azure DevOps organization name',
      default: config.organization,
    })
    .option('project', {
      type: 'string',
      description: 'Project name',
      default: config.project,
    })
    .option('repositoryId', {
      type: 'string',
      description: 'Repository ID',
      default: config.repositoryId,
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
      default: config.personalAccessToken,
    })
    .option('dryRun', {
      type: 'boolean',
      description: 'Run the script in dry-run mode (no actual request to Azure DevOps)',
      default: config.dryRun,
    })
    .parse();

  if (!config.personalAccessToken && !argv.personalAccessToken) {
    throw new Error('Error: Personal Access Token is not set in the configuration or provided as an argument.');
  }

  console.log(neonGreen('\nEvaluated CLI Arguments:'));
  const cliArgs: [string, string][] = [
    ['ORGANIZATION', neonPink(argv.organization || 'Not set')],
    ['PROJECT', neonPink(argv.project || 'Not set')],
    ['REPOSITORY_ID', neonPink(argv.repositoryId || 'Not set')],
    ['TITLE', neonPink(argv.title)],
    ['DESCRIPTION', neonPink(argv.description)],
    ['PERSONAL_ACCESS_TOKEN', neonPink((argv.personalAccessToken || 'Not set').substring(0, 10) + '...')],
  ];
  console.log(createConfiguredTable(cliArgs));


  const spinner = ora({
    text: chalk.blue('Fetching git diff...'),
    spinner: 'dots',
    color: 'cyan'
  }).start();
  const gitDiff = await getGitDiff();
  spinner.succeed(neonPink('Git diff fetched.'));

  spinner.start(chalk.blue('Getting current branch...'));
  const sourceBranch = await getCurrentBranch();
  spinner.succeed(neonPink('Current branch obtained.'));
  const defaultTargetBranch = 'main'; // Assuming 'main' is your default target branch
  const targetBranch = config.targetBranch ? config.targetBranch : (sourceBranch === defaultTargetBranch ? 'develop' : defaultTargetBranch)

  if (sourceBranch === targetBranch) {
    throw new Error('Source and target branches cannot be the same. Please make sure you are not on the main branch.');
  }

  if (!argv.title) {
    const titleSpinner = ora({
      text: neonBlue('Generating pull request title...'),
      spinner: 'dots',
      color: 'cyan'
    }).start();
    argv.title = await generateWithAI("Generate a concise and descriptive pull request title based on the following git diff:", gitDiff.summary, true, false);
    titleSpinner.succeed(neonPink('Pull request title generated.'));
  }

  if (!argv.description) {
    const descriptionSpinner = ora({
      text: neonBlue('Generating pull request description...'),
      spinner: 'dots',
      color: 'cyan'
    }).start();
    const prTemplate = await readPRTemplate(path.dirname(__filename));
    argv.description = await generatePRDescription(gitDiff.summary, prTemplate, true, false);
    descriptionSpinner.succeed(neonPink('Pull request description generated.'));
  }

  let pullRequestId: string | number = 'dry-run-id';
  if (argv.dryRun) {
    console.log(neonGreen('Dry run mode enabled. No pull request will be created.'));
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
    ['Pull Request ID', pullRequestId.toString()],
    ['Title', argv.title],
    ['Source Branch', sourceBranch],
    ['Target Branch', targetBranch],
    ['Description', argv.description],
    ['View PR', `https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`],
  ];

  if (argv.dryRun) {
    console.log(neonGreen('Dry-run mode: Pull request details:'));
  } else {
    console.log(neonGreen('Pull request created successfully:'));
  }
  console.log(createConfiguredTable(prDetails));
}

main().catch((error) => {
  console.log(neonGreen('Unhandled error in main:'), error);
});
