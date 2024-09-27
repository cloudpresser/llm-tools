import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import dotenv from 'dotenv';
import simpleGit from 'simple-git';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import * as prettyCli from 'pretty-cli';
import chalk from 'chalk';
import ora from 'ora';
import columnify from 'columnify';

dotenv.config();

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getCurrentBranch(): Promise<string> {
  const git = simpleGit();
  const branchSummary = await git.branch();
  return branchSummary.current;
}

async function getGitDiff(): Promise<string> {
  const git = simpleGit();
  return git.diff();
}

async function readPRTemplate(): Promise<string> {
  const spinner = ora('Reading PR template...').start();

  try {
    const templatePath = path.join(process.cwd(), 'prTemplate.md');
    const template = await fs.readFile(templatePath, 'utf-8');
    spinner.succeed('PR template read successfully.');
    return template;
  } catch (error) {
    spinner.fail('Unable to read PR template. Using default template.');
    return '## Summary:\n\n## Test Plan:\n\n## Review:';
  }
}

async function generateWithAI(prompt: string, gitDiff: string): Promise<string> {
  // Limit git diff size
  const limitedGitDiff = gitDiff.length > 2000 ? gitDiff.substring(0, 2000) + "..." : gitDiff;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are an AI assistant helping with pull request reviews." },
      { role: "user", content: `${prompt}\n\nGit Diff:\n${limitedGitDiff}` }
    ],
  });

  return response.choices[0].message?.content || '';
}

async function retrieveRelevantInfo(gitDiff: string): Promise<string> {
  // Implement RAG logic here
  // For example, you could search a documentation database or codebase for relevant information
  // For now, we'll return a placeholder
  return "Relevant project guidelines and best practices...";
}

async function generatePRDescription(gitDiff: string, template: string): Promise<string> {
  const summaryPrompt = `Generate a concise summary for a pull request based on the given git diff. Include the motivation and problem solved.`;
  const testPlanPrompt = `Generate a brief test plan for a pull request based on the given git diff. Include key test areas and any specific commands to run.`;

  const summary = await generateWithAI(summaryPrompt, gitDiff);
  const testPlan = await generateWithAI(testPlanPrompt, gitDiff);

  return template
    .replace('<!-- Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->', '')
    .replace('<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->', summary)
    .replace('<!-- Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests) \nFor more details, see: https://gray-smoke-082026a10-docs.centralus.2.azurestaticapps.net/Pull-Request-Policy/PR-Review-Guidelines\n-->', testPlan);
}

async function main() {
  console.log(chalk.blue('Environment variables:'));
  console.log(chalk.green('ORGANIZATION:'), process.env.ORGANIZATION || 'Not set');
  console.log(chalk.green('PROJECT:'), process.env.PROJECT || 'Not set');
  console.log(chalk.green('REPOSITORY_ID:'), process.env.REPOSITORY_ID || 'Not set');
  console.log(chalk.green('PERSONAL_ACCESS_TOKEN:'), process.env.PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : 'Not set');
  console.log(chalk.green('OPENAI_API_KEY:'), process.env.OPENAI_API_KEY ? '[REDACTED]' : 'Not set');

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
    })
    .option('description', {
      type: 'string',
      description: 'Pull request description',
    })
    .option('personalAccessToken', {
      type: 'string',
      description: 'Azure DevOps personal access token',
      default: process.env.PERSONAL_ACCESS_TOKEN,
    })
    .option('openaiApiKey', {
      type: 'string',
      description: 'OpenAI API Key',
      default: process.env.OPENAI_API_KEY,
    })
    .parse();

  if (!process.env.PERSONAL_ACCESS_TOKEN && !argv.personalAccessToken) {
    throw new Error('Error: Personal Access Token is not set in the .env file or provided as an argument.');
  }

  if (!process.env.OPENAI_API_KEY && !argv.openaiApiKey) {
    throw new Error('Error: OpenAI API Key is not set in the .env file or provided as an argument.');
  }

  console.log(chalk.blue('Evaluated CLI arguments:'));
  console.log(chalk.green('ORGANIZATION:'), argv.organization || 'Not set');
  console.log(chalk.green('PROJECT:'), argv.project || 'Not set');
  console.log(chalk.green('REPOSITORY_ID:'), argv.repositoryId || 'Not set');
  console.log(chalk.green('TITLE:'), argv.title || 'Not set (will be generated)');
  console.log(chalk.green('DESCRIPTION:'), argv.description || 'Not set (will be generated)');
  console.log(chalk.green('PERSONAL_ACCESS_TOKEN:'), argv.personalAccessToken ? '[REDACTED]' : 'Not set');
  console.log(chalk.green('OPENAI_API_KEY:'), argv.openaiApiKey ? '[REDACTED]' : 'Not set');

  try {
    const spinner = ora('Fetching git diff...').start();
    const gitDiff = await getGitDiff();
    spinner.succeed('Git diff fetched.');

    spinner.start('Getting current branch...');
    const sourceBranch = await getCurrentBranch();
    spinner.succeed('Current branch obtained.');
    const defaultTargetBranch = 'main'; // Assuming 'main' is your default target branch
    const targetBranch = sourceBranch === defaultTargetBranch ? 'develop' : defaultTargetBranch;

    if (sourceBranch === targetBranch) {
      throw new Error('Source and target branches cannot be the same. Please make sure you are not on the main branch.');
    }

    if (!argv.title) {
      const titleSpinner = ora('Generating pull request title...').start();
      argv.title = await generateWithAI("Generate a concise and descriptive pull request title based on the following git diff:", gitDiff);
      titleSpinner.succeed('Pull request title generated.');

    }

    if (!argv.description) {
      const descriptionSpinner = ora('Generating pull request description...').start();
      const prTemplate = await readPRTemplate();
      descriptionSpinner.succeed('Pull request description generated.');
      argv.description = await generatePRDescription(gitDiff, prTemplate);
    }

    console.log(chalk.blue('Pull Request Parameters:'));
    console.log(chalk.green('Source Branch:'), sourceBranch);
    console.log(chalk.green('Target Branch:'), targetBranch);
    console.log(chalk.green('Organization:'), argv.organization || '');
    console.log(chalk.green('Project:'), argv.project || '');
    console.log(chalk.green('Repository ID:'), argv.repositoryId || '');
    console.log(chalk.green('Title:'), argv.title);
    console.log(chalk.green('Description:'));
    console.log(chalk.green(argv.description));
    console.log(chalk.green('Work Items:'), []); // Empty array as per your current implementation

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
      const tempFile = path.join(process.cwd(), `${filePrefix}_temp.md`);
      await fs.writeFile(tempFile, initialContent);

      const editor = ['nvim', 'nano', 'vim'].find(isCommandAvailable);
      if (!editor) {
        console.log('No suitable editor found. Skipping manual edit.');
        return initialContent;
      }

      try {
        execSync(`${editor} ${tempFile}`, { stdio: 'inherit' });
        const editedContent = await fs.readFile(tempFile, 'utf-8');
        await fs.unlink(tempFile);
        return editedContent.trim();
      } catch (error) {
        console.error('Error while editing:', error);
        return initialContent;
      }
    }

    // Open editor for title
    argv.title = await openEditor(argv.title, 'pr_title');
    console.log('Updated Title:', argv.title);

    // Open editor for description
    argv.description = await openEditor(argv.description, 'pr_description');
    console.log('Updated Description:');
    console.log(argv.description);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirm = await new Promise<string>(resolve => {
      rl.question('Do you want to create this pull request? (y/n) ', resolve);
    });

    rl.close();

    if (confirm.toLowerCase() !== 'y') {
      console.log('Pull request creation cancelled.');
      return;
    }

    console.log(chalk.blue('Creating pull request...'));
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
    spinner.start('Creating pull request...');

    if (!argv.organization || !argv.project || !argv.repositoryId) {
      console.warn('Warning: Some required parameters were not provided. Check your .env file or command-line arguments.');
    }

    spinner.succeed('Pull request created successfully.');

    console.log(chalk.green('Pull request created successfully:'));
    const prDetails = {
      'Pull Request ID': pullRequestId,
      'Title': argv.title,
      'Source Branch': sourceBranch,
      'Target Branch': targetBranch,
      'Description': argv.description,
      'View PR': `https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`
    };

    console.log(columnify(prDetails, { columnSplitter: ' | ' }));
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(chalk.red('Error creating pull request:'), error.message);
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
      console.log(chalk.red('An unknown error occurred:'), error);
    }
    console.log(chalk.yellow('\nTroubleshooting steps:'));
    console.log(chalk.yellow('1. Double-check the organization, project, and repository details in your .env file.'));
    console.log(chalk.yellow('2. Ensure you have the necessary permissions in the Azure DevOps project.'));
    console.log(chalk.yellow('3. Check your network connection and try again.'));
    console.log(chalk.yellow('4. If the issue persists, try running the command with verbose logging:'));
    console.log(chalk.yellow('   DEBUG=axios npx ts-node cli-ai.ts [your-options-here]'));
  }
}

main().catch((error) => {
  console.log(chalk.red('Unhandled error in main:'), error);
});
