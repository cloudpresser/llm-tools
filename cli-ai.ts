import yargs from 'yargs';
import { createPullRequest } from './src/azureDevOpsClient';
import dotenv from 'dotenv';
import simpleGit from 'simple-git';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import columnify from 'columnify';
import { table } from 'table';

// Custom neon colors
const neonBlue = chalk.hex('#00FFFF');
const neonPink = chalk.hex('#FF00FF');
const neonPurple = chalk.hex('#800080');
const neonYellow = chalk.hex('#FFFF00');
const neonOrange = chalk.hex('#FFA500');
const neonGreen = chalk.hex('#39FF14');

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
  const spinner = ora({
    text: neonBlue('Reading PR template...'),
    spinner: 'dots',
    color: 'cyan'
  }).start();

  try {
    const templatePath = path.join(process.cwd(), 'prTemplate.md');
    const template = await fs.readFile(templatePath, 'utf-8');
    spinner.succeed(neonPink('PR template read successfully.'));
    return template;
  } catch (error) {
    spinner.fail(neonOrange('Unable to read PR template. Using default template.'));
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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const config = {
    columns: {
      0: { alignment: 'right', width: 15 },
      1: { alignment: 'left', width: 50 },
    },
    columnDefault: {
      wrapWord: true,
    },
    border: {
      topBody: neonBlue('─'),
      topJoin: neonBlue('┬'),
      topLeft: neonBlue('┌'),
      topRight: neonBlue('┐'),
      bottomBody: neonBlue('─'),
      bottomJoin: neonBlue('┴'),
      bottomLeft: neonBlue('└'),
      bottomRight: neonBlue('┘'),
      bodyLeft: neonBlue('│'),
      bodyRight: neonBlue('│'),
      bodyJoin: neonBlue('│'),
      joinBody: neonBlue('─'),
      joinLeft: neonBlue('├'),
      joinRight: neonBlue('┤'),
      joinJoin: neonBlue('┼'),
    },
  };

  console.log(neonGreen('\nEnvironment Variables:'));
  const envVars: [string, string][] = [
    ['ORGANIZATION', neonPink(process.env.ORGANIZATION || 'Not set')],
    ['PROJECT', neonPink(process.env.PROJECT || 'Not set')],
    ['REPOSITORY_ID', neonPink(process.env.REPOSITORY_ID || 'Not set')],
    ['PERSONAL_ACCESS_TOKEN', neonPink(process.env.PERSONAL_ACCESS_TOKEN ? '[REDACTED]' : 'Not set')],
    ['OPENAI_API_KEY', neonPink(process.env.OPENAI_API_KEY ? '[REDACTED]' : 'Not set')],
  ];
  console.log(table(envVars, config));

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

  console.log(neonGreen('\nEvaluated CLI Arguments:'));
  const cliArgs: [string, string][] = [
    ['ORGANIZATION', neonPink(argv.organization || 'Not set')],
    ['PROJECT', neonPink(argv.project || 'Not set')],
    ['REPOSITORY_ID', neonPink(argv.repositoryId || 'Not set')],
    ['TITLE', neonPink(argv.title || 'Not set (will be generated)')],
    ['DESCRIPTION', neonPink(argv.description || 'Not set (will be generated)')],
    ['PERSONAL_ACCESS_TOKEN', neonPink(argv.personalAccessToken ? '[REDACTED]' : 'Not set')],
    ['OPENAI_API_KEY', neonPink(argv.openaiApiKey ? '[REDACTED]' : 'Not set')],
  ];
  console.log(table(cliArgs, config));

  try {
    const spinner = ora({
      text: neonBlue('Fetching git diff...'),
      spinner: 'dots',
      color: 'cyan'
    }).start();
    const gitDiff = await getGitDiff();
    spinner.succeed(neonPink('Git diff fetched.'));

    spinner.start(neonBlue('Getting current branch...'));
    const sourceBranch = await getCurrentBranch();
    spinner.succeed(neonPink('Current branch obtained.'));
    const defaultTargetBranch = 'main'; // Assuming 'main' is your default target branch
    const targetBranch = sourceBranch === defaultTargetBranch ? 'develop' : defaultTargetBranch;

    if (sourceBranch === targetBranch) {
      throw new Error('Source and target branches cannot be the same. Please make sure you are not on the main branch.');
    }

    if (!argv.title) {
      const titleSpinner = ora({
        text: neonBlue('Generating pull request title...'),
        spinner: 'dots',
        color: 'cyan'
      }).start();
      argv.title = await generateWithAI("Generate a concise and descriptive pull request title based on the following git diff:", gitDiff);
      titleSpinner.succeed(neonPink('Pull request title generated.'));
    }

    if (!argv.description) {
      const descriptionSpinner = ora({
        text: neonBlue('Generating pull request description...'),
        spinner: 'dots',
        color: 'cyan'
      }).start();
      const prTemplate = await readPRTemplate();
      argv.description = await generatePRDescription(gitDiff, prTemplate);
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
      ['Title', neonPink(argv.title)],
      ['Source Branch', neonPink(sourceBranch)],
      ['Target Branch', neonPink(targetBranch)],
      ['Description', neonPink((argv.description.length > 50 ? argv.description.substring(0, 50) + '...' : argv.description))],
    ];

    console.log(table(prDetailsEditTitle, config));

    // Ask if user wants to edit title
    const editTitle = await askToEdit('Do you want to edit the pull request title? (y/n) ');
    if (editTitle) {
      argv.title = await openEditor(argv.title, 'pr_title');
    }

    console.log(neonGreen('\nUpdated Pull Request Details:'));

    const prDetailsEditDescription: [string, string][] = [
      ['Title', neonPink(argv.title)],
      ['Source Branch', neonPink(sourceBranch)],
      ['Target Branch', neonPink(targetBranch)],
      ['Description', neonPink((argv.description))],
    ];

    console.log(table(prDetailsEditDescription, config));
    
    // Ask if user wants to edit description
    const editDescription = await askToEdit('Do you want to edit the pull request description? (y/n) ');
    if (editDescription) {
      argv.description = await openEditor(argv.description, 'pr_description');
    }


    const confirm = await askToEdit('Do you want to create this pull request? (y/n) ');

    if (!confirm) {
      console.log(neonGreen('Pull request creation cancelled.'));
      rl.close();
      return;
    }

    console.log(neonGreen('Creating pull request...'));


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

    spinner.succeed(neonPink('Pull request created successfully.'));

    console.log(neonGreen('Pull request created successfully:'));
    const finalPrDetails: [string, string][] = [
      ['Title', neonPink(argv.title)],
      ['Source Branch', neonPink(sourceBranch)],
      ['Target Branch', neonPink(targetBranch)],
      ['Description', neonPink( (argv.description.length > 50 ? argv.description.slice(0, 50) + '...' : ''))],
      ['Pull Request ID', neonPink(pullRequestId.toString())],
      ['View PR', neonBlue(`https://dev.azure.com/${argv.organization}/${argv.project}/_git/${argv.repositoryId}/pullrequest/${pullRequestId}`)],
    ];
    console.log(neonGreen('\nPull Request Created Successfully:'));
    console.log(table(finalPrDetails, config));
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

main().catch((error) => {
  console.log(neonGreen('Unhandled error in main:'), error);
});
