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
    const targetBranch = config.targetBranch;

    const currentBranch = (await git.revparse(['--abbrev-ref', 'HEAD'])).trim();

    // Extract remote name from target branch (e.g. "origin" from "origin/onboarding")
    const remoteMatch = targetBranch.match(/^([^/]+)\//);
    if (remoteMatch) {
      const remote = remoteMatch[1];
      if (config.debug) {
        console.log(`[debug] Fetching remote '${remote}' to ensure target branch is up-to-date...`);
      }
      try {
        await git.fetch(remote);
      } catch (fetchError) {
        console.warn(`Warning: Failed to fetch remote '${remote}':`, (fetchError as Error).message);
      }
    }

    if (config.debug) {
      console.log(`[debug] Current branch (HEAD): ${currentBranch}`);
      console.log(`[debug] Source branch (config): ${sourceBranch}`);
      console.log(`[debug] Target branch (config): ${targetBranch}`);
      if (currentBranch !== sourceBranch) {
        console.log(`[debug] WARNING: HEAD (${currentBranch}) differs from sourceBranch (${sourceBranch})`);
      }

      // Log the resolved commits for each ref
      const sourceCommit = (await git.revparse([sourceBranch])).trim();
      const targetCommit = (await git.revparse([targetBranch])).trim();
      console.log(`[debug] Source branch resolves to: ${sourceCommit}`);
      console.log(`[debug] Target branch resolves to: ${targetCommit}`);
    }

    if (config.debug) {
      console.log(`[debug] Equivalent git command: git diff ${targetBranch} ${sourceBranch}`);
    }

    // Diff source against target directly (two-dot diff).
    // This shows exactly what would change in the target branch if source were merged.
    const diff = await git.diff([targetBranch, sourceBranch, '-p']);

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
