import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export interface EnvConfig {
  fs: typeof fs;
  path: typeof path;
  dotenv: typeof dotenv;
  process: NodeJS.Process;
}

export function findGitRepoRoot(startPath: string, config: EnvConfig): string | null {
  let currentPath = startPath;
  while (currentPath !== '/') {
    if (config.fs.existsSync(config.path.join(currentPath, '.git'))) {
      return currentPath;
    }
    currentPath = config.path.dirname(currentPath);
  }
  return null;
}

export function loadEnv(config: EnvConfig = { fs, path, dotenv, process }): Record<string, string> {
  const gitRoot = findGitRepoRoot(config.process.cwd(), config);
  const envPaths = [
    gitRoot ? config.path.join(gitRoot, '.env') : null,
    config.path.join(config.process.env.HOME || '', '.env'),
    config.path.join(config.process.env.HOME || '', '.config', '.env')
  ].filter(Boolean) as string[];

  let loadedEnv: Record<string, string> = {};

  for (const envPath of envPaths) {
    if (config.fs.existsSync(envPath)) {
      const result = config.dotenv.config({ path: envPath });
      if (!result.error && result.parsed) {
        loadedEnv = { ...loadedEnv, ...result.parsed };
      }
    }
  }

  return { ...loadedEnv, ...config.process.env } as Record<string, string>;
}
