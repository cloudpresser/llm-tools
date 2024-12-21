import { SOPParams } from './types';
import { Instructor } from "@instructor-ai/instructor";
import * as fs from 'fs';
import { generateSOP } from './generator';

export async function identifySubProcesses(sopPath: string, client: Instructor): Promise<string[]> {
  const sopContent = fs.readFileSync(sopPath, 'utf-8');
  
  const response = await client.chat.completions.create({
    messages: [{
      role: "user",
      content: `Analyze this SOP and identify distinct sub-processes that could be separate SOPs. 
                Return only the names of the sub-processes as a JSON array of strings.
                
                SOP Content:
                ${sopContent}`
    }],
    model: "o1-preview"
  });

  const content = response.choices[0].message.content;
  // Clean up the response by removing markdown formatting and any extra text
  const cleanedContent = content.replace(/```json\n|\n```/g, '').trim();
  return JSON.parse(cleanedContent);
}

export async function generateSubProcessSOPs(
  originalParams: SOPParams,
  subProcesses: string[],
  kbPath: string | undefined,
  dbPath: string,
  client: Instructor
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
