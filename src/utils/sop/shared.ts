import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { loadEnv } from '../../loadEnv';
import * as path from 'path';
import os from 'os';

export function initializeAIClients() {
  const env = loadEnv();
  const oai = new OpenAI({
    apiKey: env.OPENAI_API_KEY ?? undefined,
    organization: env.OPENAI_ORG_ID ?? undefined
  });

  return new Instructor({
    client: oai,
    mode: "FUNCTIONS"  // Required mode for Instructor to work properly
  });
}

export function getDefaultDBPath() {
  const xdgConfigPath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfigPath, "sop-generator", "vector-db");
}
