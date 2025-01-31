import axios from 'axios';
import { isString } from 'util';
import { getConfig, WorkItem } from '@cloudpresser/shared';
import { createConfiguredTable } from '@cloudpresser/shared';
import { PullRequestParams } from './PullRequestParams';

export async function createPullRequest(params: PullRequestParams): Promise<number> {

  const config = await getConfig();

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

  console.log('Creating Pull Request...');
  console.log(`Source Branch: ${sourceBranch}`);
  console.log(`Target Branch: ${targetBranch}`);
  const requestParams = {
    sourceRefName: `refs/heads/${sourceBranch.replace(/^origin\//, '')}`,
    targetRefName: `refs/heads/${targetBranch.replace(/^origin\//, '')}`,
    title: title,
    description: description,
    workItemRefs: workItems.map((item: WorkItem) => ({ id: item.id })),
  }

  if (config.debug) {
    console.log(createConfiguredTable(
      Object.entries(requestParams).map(
        ([key, value]) => (
          [key, (isString(value) ? value : JSON.stringify(value))]
        ),
      )
    ));
  }

  try {
    const response = await axios.post(pullRequestUrl, requestParams, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${personalAccessToken}`,
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
