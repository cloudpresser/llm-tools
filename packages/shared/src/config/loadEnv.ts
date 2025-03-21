import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export function findGitRepoRoot(startPath: string): string | null {
  let currentPath = startPath;
  while (currentPath !== '/') {
    if (fs.existsSync(path.join(currentPath, '.git'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  return null;
}

export function loadEnv(): Record<string, string> {
  const gitRoot = findGitRepoRoot(process.cwd());
  const envPaths = [
    gitRoot ? path.join(gitRoot, '.cloudpresser') : null,
    path.join(process.env.HOME || '', '.cloudpresser'),
    path.join(process.env.HOME || '', '.config', '.cloudpresser'),
    '.cloudpresser' // Also check in current directory
  ].filter(Boolean) as string[];
  let loadedEnv: Record<string, string> = {};

  // console.log(`Looking for environment files in ${envPaths.join(', ')}`);
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      // console.log(`Loading environment from ${envPath}`);
      const result = dotenv.config({ path: envPath, override: true });
      if (!result.error && result.parsed) {
        loadedEnv = { ...loadedEnv, ...result.parsed };
      }
    }
  }

  return { ...process.env as Record<string, string>, ...loadedEnv };
}

export default loadEnv;
