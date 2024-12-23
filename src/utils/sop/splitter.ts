import { SOPParams } from './types';
import OpenAI from "openai";
import * as fs from 'fs';
import { generateSOP } from './generator';

export async function identifySubProcesses(sopPath: string, client: OpenAI): Promise<string[]> {
  const sopContent = fs.readFileSync(sopPath, 'utf-8');
  
  const response = await client.chat.completions.create({
    messages: [{
      role: "user",
      content: `Analyze this SOP and identify distinct sub-processes that could be separate SOPs. 
                Return only the names of the sub-processes as a JSON array of strings.
                
                SOP Content:
                ${sopContent}`
    }],
    model: "gpt-4"
  });

  const content = response.choices[0].message.content || '';
  // Clean up the response by removing markdown formatting and any extra text
  const cleanedContent = content.replace(/```json\n|\n```/g, '').trim();
  return JSON.parse(cleanedContent);
}

export async function generateSubProcessSOPs(
  originalParams: SOPParams,
  subProcesses: string[],
  kbPath: string | undefined,
  dbPath: string,
  client: OpenAI
): Promise<string[]> {
  const generatedPaths: string[] = [];

  for (const subProcess of subProcesses) {
    const subProcessParams: SOPParams = {
      ...originalParams,
      title: `${originalParams.title} - ${subProcess}`,
      description: `Sub-process SOP for ${subProcess} within ${originalParams.title}`,
      keyProcesses: [subProcess],
      outputPath: originalParams.outputPath
    };

    const outputPath = await generateSOP(subProcessParams, kbPath, dbPath, client);
    generatedPaths.push(outputPath);
  }

  return generatedPaths;
}
