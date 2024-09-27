import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import dotenv from 'dotenv';
import simpleGit from 'simple-git';
import { log } from 'pretty-cli';
import chalk from 'chalk';

dotenv.config();

async function getCurrentBranch(): Promise<string> {
  const git = simpleGit();
  const branchSummary = await git.branch();
  return branchSummary.current;
}

async function main() {
  log(chalk.blue('Environment variables:'));
  log(chalk.green('ORGANIZATION:'), process.env.ORGANIZATION || 'Not set');
  log(chalk.green('PROJECT:'), process.env.PROJECT || 'Not set');
  log(chalk.green('REPOSITORY_ID:'), process.env.REPOSITORY_ID || 'Not set');
  log(chalk.green('PERSONAL_ACCESS_TOKEN:'), process.env.PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : 'Not set');

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

  log(chalk.blue('Evaluated CLI arguments:'));
  log(chalk.green('ORGANIZATION:'), argv.organization || 'Not set');
  log(chalk.green('PROJECT:'), argv.project || 'Not set');
  log(chalk.green('REPOSITORY_ID:'), argv.repositoryId || 'Not set');
  log(chalk.green('TITLE:'), argv.title);
  log(chalk.green('DESCRIPTION:'), argv.description);
  log(chalk.green('PERSONAL_ACCESS_TOKEN:'), argv.personalAccessToken ? '[REDACTED]' : 'Not set');

  try {
    const sourceBranch = await getCurrentBranch();
    const targetBranch = 'main'; // Assuming 'main' is your default target branch

    log(chalk.blue('Pull Request Parameters:'));
    log(chalk.green('Source Branch:'), sourceBranch);
    log(chalk.green('Target Branch:'), targetBranch);
    log(chalk.green('Organization:'), argv.organization || '');
    log(chalk.green('Project:'), argv.project || '');
    log(chalk.green('Repository ID:'), argv.repositoryId || '');
    log(chalk.green('Title:'), argv.title);
    log(chalk.green('Description:'), argv.description);
    log(chalk.green('Work Items:'), []); // Empty array as per your current implementation
    log(chalk.green('Personal Access Token:'), argv.personalAccessToken ? '[REDACTED]' : 'Not set');

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

    log(chalk.blue('Pull request created successfully:'));
    log(chalk.green(`Pull Request ID: ${pullRequestId}`));
    log(chalk.green(`Title: ${argv.title}`));
    log(chalk.green(`Source Branch: ${sourceBranch}`));
    log(chalk.green(`Target Branch: ${targetBranch}`));
    log(chalk.green(`Description: ${argv.description}`));
    log(chalk.green(`View PR: https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`));
  } catch (error: unknown) {
    if (error instanceof Error) {
      log(chalk.red('Error creating pull request:'), error.message);
      if (error.message.includes('Authentication failed')) {
        console.log('\nAuthentication Error Details:');
        console.log('1. Ensure your Personal Access Token is valid and has not expired.');
        console.log('2. Verify that your Personal Access Token has the necessary scopes:');
        console.log('   - Code (Read & Write)');
        console.log('   - Pull Request Contribute');
        console.log('3. Check if you can access the Azure DevOps web interface for this project.');
        console.log('4. Try generating a new Personal Access Token and update the .env file.');
      }
    } else {
      log(chalk.red('An unknown error occurred:'), error);
    }
    log(chalk.yellow('\nTroubleshooting steps:'));
    log(chalk.yellow('1. Double-check the organization, project, and repository details in your .env file.'));
    log(chalk.yellow('2. Ensure you have the necessary permissions in the Azure DevOps project.'));
    log(chalk.yellow('3. Check your network connection and try again.'));
    log(chalk.yellow('4. If the issue persists, try running the command with verbose logging:'));
    log(chalk.yellow('   DEBUG=axios npx ts-node cli.ts [your-options-here]'));
  }
}

main().catch((error) => {
  log(chalk.red('Unhandled error in main:'), error);
});
