import yargs from 'yargs';
import { loadEnv } from './loadEnv';
import { getCurrentBranch } from './getCurrentBranch';

export interface WorkItem {
  id: number;
}

export interface Config {
  organization: string;
  project: string;
  repositoryId: string;
  title?: string;
  description?: string;
  personalAccessToken: string;
  openaiApiKey: string;
  mock: boolean;
  dryRun: boolean;
  targetBranch: string;
  sourceBranch: string;
  workItems: WorkItem[];
}

function getCliArgs(): Partial<Config> {
  return yargs(process.argv.slice(2))
    .option('organization', { type: 'string' })
    .option('project', { type: 'string' })
    .option('repositoryId', { type: 'string' })
    .option('title', { type: 'string' })
    .option('description', { type: 'string' })
    .option('personalAccessToken', { type: 'string' })
    .option('openaiApiKey', { type: 'string' })
    .option('mock', { type: 'boolean', default: false })
    .option('dryRun', { type: 'boolean', default: false })
    .option('targetBranch', { type: 'string' })
    .option('sourceBranch', { type: 'string' })
    .option('workItems', { type: 'array' })
    .argv as Partial<Config>;
}

export async function getConfig(): Promise<Config> {
  const env = loadEnv();
  const cliArgs = getCliArgs();

  const currentBranch = await getCurrentBranch();
  const defaultTargetBranch = 'staging';

  const config: Config = {
    organization: cliArgs.organization || env.ORGANIZATION || '',
    project: cliArgs.project || env.PROJECT || '',
    repositoryId: cliArgs.repositoryId || env.REPOSITORY_ID || '',
    title: cliArgs.title,
    description: cliArgs.description,
    personalAccessToken: cliArgs.personalAccessToken || env.PERSONAL_ACCESS_TOKEN || '',
    openaiApiKey: cliArgs.openaiApiKey || env.OPENAI_API_KEY || '',
    mock: cliArgs.mock || false,
    dryRun: cliArgs.dryRun || false,
    targetBranch: cliArgs.targetBranch || env.TARGET_BRANCH || (currentBranch === defaultTargetBranch ? 'develop' : defaultTargetBranch),
    sourceBranch: cliArgs.sourceBranch || currentBranch,
    workItems: cliArgs.workItems as WorkItem[] || [],
  };

  return config;
}
