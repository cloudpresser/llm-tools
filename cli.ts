import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import dotenv from 'dotenv';
import simpleGit from 'simple-git';

dotenv.config();

async function getCurrentBranch(): Promise<string> {
  const git = simpleGit();
  const branchSummary = await git.branch();
  return branchSummary.current;
}

async function main() {
  console.log('Environment variables:');
  console.log('ORGANIZATION:', process.env.ORGANIZATION || 'Not set');
  console.log('PROJECT:', process.env.PROJECT || 'Not set');
  console.log('REPOSITORY_ID:', process.env.REPOSITORY_ID || 'Not set');
  console.log('PERSONAL_ACCESS_TOKEN:', process.env.PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : 'Not set');

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

  if (!process.env.PERSONAL_ACCESS_TOKEN) {
    throw new Error('Error: Personal Access Token is not set in the .env file.');
  }

  if (!argv.personalAccessToken) {
    console.error('Error: Personal Access Token is required.');
    console.log('Please provide a valid Personal Access Token using the --personalAccessToken option or set it in your .env file.');
    process.exit(1);
  }

  console.log('Evaluated CLI arguments:');
  console.log('ORGANIZATION:', argv.organization || 'Not set');
  console.log('PROJECT:', argv.project || 'Not set');
  console.log('REPOSITORY_ID:', argv.repositoryId || 'Not set');
  console.log('TITLE:', argv.title);
  console.log('DESCRIPTION:', argv.description);
  console.log('PERSONAL_ACCESS_TOKEN:', argv.personalAccessToken ? '[REDACTED]' : 'Not set');

  try {
    const currentBranch = await getCurrentBranch();

    const sourceBranch = await getCurrentBranch();
    const targetBranch = 'main'; // Assuming 'main' is your default target branch

    console.log('Pull Request Parameters:');
    console.log('Source Branch:', sourceBranch);
    console.log('Target Branch:', targetBranch);
    console.log('Organization:', argv.organization || '');
    console.log('Project:', argv.project || '');
    console.log('Repository ID:', argv.repositoryId || '');
    console.log('Title:', argv.title);
    console.log('Description:', argv.description);
    console.log('Work Items:', []); // Empty array as per your current implementation
    console.log('Personal Access Token:', argv.personalAccessToken ? '[REDACTED]' : 'Not set');

    const pullRequestId = await createPullRequest({
      organization: argv.organization || '',
      project: argv.project || '',
      repositoryId: argv.repositoryId || '',
      title: argv.title,
      description: argv.description,
      workItems: [],
      targetBranch: targetBranch,
      sourceBranch: sourceBranch,
      personalAccessToken: argv.personalAccessToken,
    });

    if (!argv.organization || !argv.project || !argv.repositoryId) {
      console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
    }

    console.log('Pull request created successfully:');
    console.log(`Pull Request ID: ${pullRequestId}`);
    console.log(`Title: ${argv.title}`);
    console.log(`Source Branch: ${sourceBranch}`);
    console.log(`Target Branch: main`); // Assuming 'main' is your default target branch
    console.log(`Description: ${argv.description}`);
    console.log(`View PR: https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error creating pull request:', error.message);
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
      console.error('An unknown error occurred:', error);
    }
    console.log('\nTroubleshooting steps:');
    console.log('1. Double-check the organization, project, and repository details in your .env file.');
    console.log('2. Ensure you have the necessary permissions in the Azure DevOps project.');
    console.log('3. Check your network connection and try again.');
    console.log('4. If the issue persists, try running the command with verbose logging:');
    console.log('   DEBUG=axios npx ts-node cli.ts [your-options-here]');
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
});
