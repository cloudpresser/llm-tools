#!/usr/bin/env node

import axios from 'axios';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

interface WorkItem {
  id: number;
  fields: {
    'System.Title': string;
    'System.AssignedTo': string;
    'System.State': string;
  };
}

async function getWorkItems(authToken: string, organizationId: string, project: string) {
  try {
    const userResponse = await axios.get(`https://dev.azure.com/${organizationId}/${project}/_apis/profile/profiles/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const userId = userResponse.data.id;

    const response = await axios.get(`https://dev.azure.com/${organizationId}/${project}/_apis/wit/workitems?api-version=6.0`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    const workItems: WorkItem[] = response.data.value;
    const assignedWorkItems = workItems.filter(item =>
      item.fields['System.AssignedTo']?.includes(userId)
    );

    return assignedWorkItems;
  } catch (error) {
    console.error('Error fetching work items:', error);
    process.exit(1);
  }
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('token', {
      alias: 't',
      type: 'string',
      demandOption: true,
      description: 'Azure Personal Access Token'
    })
    .option('organization', {
      alias: 'o',
      type: 'string',
      demandOption: true,
      description: 'Azure DevOps Organization ID'
    })
    .option('project', {
      alias: 'p',
      type: 'string',
      demandOption: true,
      description: 'Azure DevOps Project'
    })
    .help()
    .parse();

  const workItems = await getWorkItems(argv.token, argv.organization, argv.project);

  console.log('Assigned Work Items:', workItems);
}

main();
