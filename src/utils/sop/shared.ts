import * as path from 'path';
import os from 'os';
import { openai } from '../openai/client';

export const client = openai;

export function initializeAIClients() {
  return client;
}

export function getDefaultDBPath() {
  const xdgConfigPath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfigPath, "sop-generator", "vector-db");
}
