import readline from 'readline';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import chalk from 'chalk';
import { createConfiguredTable } from './src/createConfiguredTable';
import ora from 'ora';
import { createPullRequest } from './src/azureDevOpsClient';
import { getCurrentBranch } from './src/getCurrentBranch';
import { getGitDiff } from './src/getGitDiff';
import { readPRTemplate } from './src/readPRTemplate';
import { generateWithAI } from './src/generateWithAI';
import { generatePRDescription } from './src/generatePRDescription';
import { loadEnv } from './src/loadEnv';

const neonGreen = chalk.hex('#39FF14');
const neonOrange = chalk.hex('#FFA500');
const neonBlue = chalk.hex('#00FFFF');
const neonPink = chalk.hex('#FF00FF');

interface Arguments {
  organization?: string;
  project?: string;
  repositoryId?: string;
  title?: string;
  description?: string;
  personalAccessToken?: string;
  openaiApiKey?: string;
  mock?: boolean;
  dryRun?: boolean;
}

const env = loadEnv();

async function main(args: Arguments) {
  console.log('Starting main function');
  // Load environment variables
  console.log('Environment variables loaded');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const cliArgs = await yargs(process.argv.slice(2)).argv as Arguments;

  console.log(neonGreen('\nEnvironment Variables:'));
  const envVars: [string, string][] = [
    ['ORGANIZATION', neonPink(env.ORGANIZATION || 'Not set')],
    ['PROJECT', neonPink(env.PROJECT || 'Not set')],
    ['REPOSITORY_ID', neonPink(env.REPOSITORY_ID || 'Not set')],
    ['PERSONAL_ACCESS_TOKEN', neonPink((env.PERSONAL_ACCESS_TOKEN || 'Not set').substring(0, 10) + '...')],
    ['OPENAI_API_KEY', neonPink((env.OPENAI_API_KEY || 'Not set').substring(0, 10) + '...')],
    
  ];
  console.log(createConfiguredTable(envVars));

  if (!env.PERSONAL_ACCESS_TOKEN && !args.personalAccessToken) {
    throw new Error('Error: Personal Access Token is not set in the .env file or provided as an argument.');
  }

  if (!env.OPENAI_API_KEY && !args.openaiApiKey) {
    throw new Error('Error: OpenAI API Key is not set in the .env file or provided as an argument.');
  }

  console.log(neonGreen('\nEvaluated CLI Arguments:'));
  const parsedArgs: [string, string][] = [
    ['ORGANIZATION', neonPink(args.organization || 'Not set')],
    ['PROJECT', neonPink(args.project || 'Not set')],
    ['REPOSITORY_ID', neonPink(args.repositoryId || 'Not set')],
    ['TITLE', neonPink(args.title || 'Not set (will be generated)')],
    ['DESCRIPTION', neonPink(args.description || 'Not set (will be generated)')],
    ['PERSONAL_ACCESS_TOKEN', neonPink((args.personalAccessToken || 'Not set').substring(0, 10) + '...')],
    ['OPENAI_API_KEY', neonPink((args.openaiApiKey || 'Not set').substring(0, 10) + '...')],
  ];

  console.log(createConfiguredTable(parsedArgs));

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

    spinner.start(neonBlue('Getting current branch...'));
    const sourceBranch = await getCurrentBranch();
    spinner.succeed(neonPink('Current branch obtained.'));
    const defaultTargetBranch = 'staging'; 
    const targetBranch = env.TARGET_BRANCH? env.TARGET_BRANCH : sourceBranch === defaultTargetBranch ? 'develop' : defaultTargetBranch;

    if (sourceBranch === targetBranch) {
      throw new Error('Source and target branches cannot be the same. Please make sure you are not on the main branch.');
    }

    if (!args.title) {
      const titleSpinner = ora({
        text: neonBlue('Generating pull request title...'),
        spinner: 'dots',
        color: 'cyan'
      }).start();
      // Modify this part to provide a fallback message if gitDiff is empty
      const titlePrompt = gitDiff 
        ? "Generate a concise and descriptive pull request title based on the following git diff:"
        : "Generate a generic pull request title as no changes were detected.";
      
      args.title = args.mock
        ? "Mock Pull Request Title"
        : await generateWithAI(titlePrompt, gitDiff.summary || "No changes detected", true, args.mock as boolean);
      titleSpinner.succeed(neonPink('Pull request title generated.'));
    }

    if (!args.description) {
      const descriptionSpinner = ora({
        text: neonBlue('Generating pull request description...'),
        spinner: 'dots',
        color: 'cyan'
      }).start();
      const prTemplate = await readPRTemplate(path.dirname(__filename));
      // Modify this part to handle empty gitDiff
      args.description = args.mock
        ? "This is a mock description for the pull request."
        : await generatePRDescription(gitDiff.summary || "No changes detected", prTemplate, true, args.mock as boolean);
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

      const editor = ['nvim', 'nano', 'vim'].find(isCommandAvailable);
      if (!editor) {
        console.log(neonOrange('No suitable editor found. Skipping manual edit.'));
        spinner.fail(neonOrange('Error while editing.'));
        return initialContent;
      }

      try {
        execSync(`${editor} ${tempFile}`, { stdio: 'inherit' });
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
      ['Title', neonPink(args.title)],
      ['Source Branch', neonPink(sourceBranch)],
      ['Target Branch', neonPink(targetBranch)],
      ['Description', neonPink((args.description.length > 50 ? args.description.substring(0, 50) + '...' : args.description))],
    ];

    console.log(createConfiguredTable(prDetailsEditTitle));

    // Ask if user wants to edit title
    const editTitle = await askToEdit('Do you want to edit the pull request title? (y/n) ');
    if (editTitle) {
      args.title = await openEditor(args.title, 'pr_title');
    }

    console.log(neonGreen('\nUpdated Pull Request Details:'));

    const prDetailsEditDescription: [string, string][] = [
      ['Title', neonPink(args.title)],
      ['Source Branch', neonPink(sourceBranch)],
      ['Target Branch', neonPink(targetBranch)],
      ['Description', neonPink((args.description))],
    ];

    console.log(createConfiguredTable(prDetailsEditDescription));
    
    // Ask if user wants to edit description
    const editDescription = await askToEdit('Do you want to edit the pull request description? (y/n) ');
    if (editDescription) {
      args.description = await openEditor(args.description, 'pr_description');
    }


    let pullRequestId = 'Dry Run - No ID';
    if (args.dryRun) {
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
        organization: args.organization as string || '',
        project: args.project as string || '',
        repositoryId: args.repositoryId as string || '',
        title: args.title as string,
        description: args.description as string,
        workItems: [],
        targetBranch: targetBranch,
        sourceBranch: sourceBranch,
        personalAccessToken: args.personalAccessToken as string || '',
      }) as unknown as string;
      spinner.start('Creating pull request...');

      if (!args.organization || !args.project || !args.repositoryId) {
        console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
      }

      spinner.succeed(neonPink('Pull request created successfully.'));
    }

    const finalPrDetails: [string, string][] = [
      ['Title', neonPink(cliArgs.title)],
      ['Source Branch', neonPink(sourceBranch)],
      ['Target Branch', neonPink(targetBranch)],
      ['Description', neonPink(cliArgs.description)],
      ['Pull Request ID', neonPink(pullRequestId.toString())],
      ['View PR', args.dryRun ? neonBlue('Dry Run - No URL') : neonBlue(`https://dev.azure.com/${args.organization}/${args.project}/_git/${args.repositoryId}/pullrequest/${pullRequestId}`)],
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
    console.log(neonGreen('   DEBUG=axios npx ts-node cli-ai.ts [your-options-here]'));
  }
}

const args = yargs(process.argv.slice(2))
  .option('mock', {
    type: 'boolean',
    description: 'Use mock mode',
    default: false,
  })
  .option('dry-run', {
    type: 'boolean',
    description: 'Perform a dry run without creating a pull request',
    default: false,
  })
  .argv as Arguments;

main(args).catch((error) => {
  console.log(neonGreen('Unhandled error in main:'), error);
});
