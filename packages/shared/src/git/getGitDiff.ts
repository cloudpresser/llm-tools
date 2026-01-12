import simpleGit from 'simple-git';
import { summarizeDiff } from './summarizeDiff';
import { getConfig } from '../config';



export async function getGitDiff(): Promise<{ diff: string; summary: string }> {
  const config = await getConfig();
  const git = simpleGit();
  if (config.mock) {
    return { diff: 'This is a mock diff', summary: 'This is a mock summary' };
  }
  try {
    // Get the current branch name
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    // console.log(`Current branch: ${currentBranch}`);

    // Get the merge base between the current branch and target branch
    const mergeBase = await git.raw(['merge-base', config.targetBranch, currentBranch]);

    if (!mergeBase.trim()) {
      console.log('No merge base found. This might be a new branch with no common ancestor.');
      return { diff: '', summary: 'No changes detected or new branch with no common ancestor.' };
    }

    // console.log(`Merge base: ${mergeBase.trim()}`);

    // Get the diff between the merge base and the current branch
    const diff = await git.diff([mergeBase.trim(), currentBranch, '-p']);

    if (!diff) {
      console.log('No changes detected in the current branch compared to main.');
      console.log('Please make sure you have committed changes to your current branch.');
      return { diff: '', summary: 'No changes detected' };
    }

    // console.log(`Diff length: ${diff.length} characters`);

    if (typeof diff !== 'string') {
      console.error('Unexpected diff format:', diff);
      return { diff: '', summary: 'Error: Invalid diff format' };
    }

    if (diff.trim() === '') {
      console.log('Empty diff received.');
      return { diff: '', summary: 'No changes detected' };
    }

    // Generate a summary of the diff
    const summary = await summarizeDiff(diff);

    return { diff, summary };
  } catch (error) {
    console.error('Error getting git diff:', error);
    return { diff: '', summary: `Error: ${(error as Error).message}` };
  }
}
