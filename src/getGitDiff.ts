import simpleGit from 'simple-git';

export async function getGitDiff(): Promise<string> {
  const git = simpleGit();
  try {
    // Get the current branch name
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    
    // Get the merge base between the current branch and main
    const mergeBase = await git.raw(['merge-base', 'main', currentBranch]);
    
    // Get the diff between the merge base and the current branch
    const diff = await git.diff([mergeBase.trim(), currentBranch]);
    
    if (!diff) {
      console.log('No changes detected in the current branch compared to main.');
      return '';
    }
    
    return diff;
  } catch (error) {
    console.error('Error getting git diff:', error);
    return '';
  }
}
