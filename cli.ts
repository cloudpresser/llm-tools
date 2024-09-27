import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Environment variables:');
  console.log('ORGANIZATION:', process.env.ORGANIZATION);
  console.log('PROJECT:', process.env.PROJECT);
  console.log('REPOSITORY_ID:', process.env.REPOSITORY_ID);
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
    .option('sourceRefName', {
      type: 'string',
      description: 'Source branch name (e.g., feature-branch)',
      demandOption: true,
    })
    .option('targetRefName', {
      type: 'string',
      description: 'Target branch name (e.g., main)',
      default: process.env.TARGET_REF_NAME,
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

  console.log('Parsed CLI arguments:');
  console.log(JSON.stringify(argv, null, 2));

  try {
    if (!argv.targetRefName) {
      throw new Error('Target reference name is not set. Please provide it via command line or set TARGET_REF_NAME in your .env file.');
    }

    const pullRequestId = await createPullRequest({
      organization: argv.organization || '',
      project: argv.project || '',
      repositoryId: argv.repositoryId || '',
      description: argv.description,
      workItems: [], // You might want to add an option to input work items
      targetBranch: argv.targetRefName.replace('refs/heads/', ''),
      sourceBranch: argv.sourceRefName.replace('refs/heads/', ''),
      personalAccessToken: argv.personalAccessToken,
    });

    if (!argv.organization || !argv.project || !argv.repositoryId) {
      console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
    }

    console.log('Pull request created successfully:');
    console.log(`Pull Request ID: ${pullRequestId}`);
    console.log(`Title: ${argv.title}`);
    console.log(`Source Branch: ${argv.sourceRefName}`);
    console.log(`Target Branch: ${argv.targetRefName}`);
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
