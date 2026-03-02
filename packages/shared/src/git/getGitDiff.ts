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
    // Use the configured source branch instead of the currently checked-out branch
    const sourceBranch = config.sourceBranch;

    const currentBranch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();

    if (config.debug) {
      console.log(`[debug] Current branch (HEAD): ${currentBranch}`);
      console.log(`[debug] Source branch (config): ${sourceBranch}`);
      console.log(`[debug] Target branch (config): ${config.targetBranch}`);
      if (currentBranch !== sourceBranch) {
        console.log(`[debug] WARNING: HEAD (${currentBranch}) differs from sourceBranch (${sourceBranch})`);
      }

      // Log the resolved commits for each ref
      const sourceCommit = (await git.revparse([sourceBranch])).trim();
      const targetCommit = (await git.revparse([config.targetBranch])).trim();
      console.log(`[debug] Source branch resolves to: ${sourceCommit}`);
      console.log(`[debug] Target branch resolves to: ${targetCommit}`);
    }

    // Get the merge base between the source branch and target branch
    const mergeBase = await git.raw(['merge-base', config.targetBranch, sourceBranch]);

    if (!mergeBase.trim()) {
      console.log('No merge base found. This might be a new branch with no common ancestor.');
      return { diff: '', summary: 'No changes detected or new branch with no common ancestor.' };
    }

    if (config.debug) {
      console.log(`[debug] Merge base: ${mergeBase.trim()}`);
      console.log(`[debug] Equivalent git command: git diff ${mergeBase.trim()} ${sourceBranch}`);
    }

    // Get the diff between the merge base and the source branch
    const diff = await git.diff([mergeBase.trim(), sourceBranch, '-p']);

    if (!diff) {
      console.log('No changes detected in the current branch compared to main.');
      console.log('Please make sure you have committed changes to your current branch.');
      return { diff: '', summary: 'No changes detected' };
    }

    if (typeof diff !== 'string') {
      console.error('Unexpected diff format:', diff);
      return { diff: '', summary: 'Error: Invalid diff format' };
    }

    if (diff.trim() === '') {
      console.log('Empty diff received.');
      return { diff: '', summary: 'No changes detected' };
    }

    if (config.debug) {
      // Log diff metadata instead of the full diff content
      const files = diff.match(/^diff --git a\/.+ b\/.+$/gm) || [];
      const fileNames = files.map(f => {
        const match = f.match(/^diff --git a\/.+ b\/(.+)$/);
        return match ? match[1] : f;
      });
      console.log(`[debug] Diff stats: ${diff.length} chars, ${files.length} files changed`);
      console.log(`[debug] Files in diff:\n${fileNames.map(f => `  - ${f}`).join('\n')}`);
    }

    // Generate a summary of the diff
    const summary = await summarizeDiff(diff);

    return { diff, summary };
  } catch (error) {
    console.error('Error getting git diff:', error);
    return { diff: '', summary: `Error: ${(error as Error).message}` };
  }
}
