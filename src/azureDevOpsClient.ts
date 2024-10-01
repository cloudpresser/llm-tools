import axios from 'axios';
import { getConfig } from './config';

interface WorkItem {
  id: number;
}

interface PullRequestParams {
  organization?: string;
  project?: string;
  repositoryId?: string;
  title: string;
  description: string;
  workItems: WorkItem[];
  targetBranch: string;
  sourceBranch: string;
  personalAccessToken?: string;
}

const config = getConfig();

async function createPullRequest(params: PullRequestParams): Promise<number> {
  const {
    organization = config.organization,
    project = config.project,
    repositoryId = config.repositoryId,
    title,
    description,
    workItems,
    targetBranch,
    sourceBranch,
    personalAccessToken = config.personalAccessToken,
  } = params;

  if (!organization || !project || !repositoryId || !personalAccessToken) {
    throw new Error('Missing required parameters. Please check your environment variables or provided parameters.');
  }
  const apiVersion = '6.0';
  const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}`;

  const pullRequestUrl = `${baseUrl}/pullrequests?api-version=${apiVersion}`;

  try {
    const response = await axios.post(pullRequestUrl, {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      title: title,
      description: description,
      workItemRefs: workItems.map((item: WorkItem) => ({ id: item.id })),
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`:${personalAccessToken}`).toString('base64')}`,
      },
    });

    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
      console.error('Received HTML response. Authentication failed.');
      throw new Error('Authentication failed: Invalid or expired Personal Access Token');
    }

    if (response.data && response.data.pullRequestId) {
      console.log('Pull Request created successfully:');
      console.log(`ID: ${response.data.pullRequestId}`);
      console.log(`Status: ${response.data.status}`);
      console.log(`Created By: ${response.data.createdBy?.displayName || 'Unknown'}`);
      console.log(`Creation Date: ${response.data.creationDate}`);
      console.log(`URL: ${response.data.url}`);
      return response.data.pullRequestId;
    } else {
      throw new Error('Unexpected API response structure');
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Authentication failed: Invalid or insufficient permissions for Personal Access Token');
      }
      if (typeof error.response?.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
        throw new Error('Authentication failed: Invalid or expired Personal Access Token');
      }
      const errorMessage = error.response?.data && typeof error.response.data === 'object' && 'message' in error.response.data
        ? error.response.data.message
        : error.message;
      throw new Error(`API Error: ${errorMessage}`);
    } else if (error instanceof Error) {
      throw new Error(`API Error: ${error.message}`);
    } else {
      throw new Error('API Error: Unexpected error occurred');
    }
  }
}

export { createPullRequest };
