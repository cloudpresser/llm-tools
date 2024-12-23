import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";

export const sopSchema = z.object({
  title: z.string().describe("The title of the SOP"),
  purpose: z.string().describe("The purpose of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  scope: z.string().describe("The scope of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  rolesAndResponsibilities: z.string().describe("The roles and responsibilities section of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  procedure: z.string().describe("The procedure section of the SOP, in Markdown format, starting with a level 2 heading (##), each subsection starting with a level 3 heading (###)"),
  kpis: z.string().describe("The KPIs section of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  documentReferences: z.array(z.object({
    title: z.string().optional().describe("The name of the document or template referenced"),
    type: z.union([
      z.literal('document'),
      z.literal('template'),
      z.literal('SOP'),
      z.literal('policy'),
      z.literal('checklist'),
      z.literal('flowchart'),
      z.literal('diagram'),
      z.literal('image'),
    ]).optional().describe("The type of the document or template referenced"),
    link: z.string().optional().describe("The URL or path to the document or template"),
    description: z.string().optional().describe("A description of the document or template referenced"),
  }).describe("A document or template reference")).describe("A list of document or template references, each containing a title, type, and link"),
});

export type SOPContent = z.infer<typeof sopSchema>;

export async function generateSOPContent(
  client: OpenAI,
  prompt: string,
): Promise<SOPContent> {
  const completion = await client.beta.chat.completions.parse({
    messages: [{ role: 'user', content: prompt }],
    model: "gpt-4o-2024-08-06",
    response_format: zodResponseFormat(sopSchema, 'sop_content'),
  });

  const content = completion.choices[0].message.parsed;

  if (!content) {
    throw new Error('No content received from AI');
  }

  return content;
}

export function formatSOPContent(content: SOPContent): string {
  const documentReferences = [
    `### Documents

Documents, checklists, images, diagrams, flowcharts, SOPs, policies, ...`,
    content.documentReferences.map((ref) => {
      return `### ${ref.title} \n  - [Link](${ref.link}) \n  - ${ref.description} \n - Type: ${ref.type}`;
    }).join('\n')
  ];

  return [
    `# ${content.title || 'Standard Operating Procedure'}`,
    content.purpose,
    content.scope,
    content.rolesAndResponsibilities,
    content.procedure,
    content.kpis,
    documentReferences.join('\n')
  ].join('\n\n');
}
