import { z } from 'zod';
import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";

export const sopSchema = z.object({
  title: z.string().describe("The title of the SOP"),
  purpose: z.string().optional().describe("The purpose of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  scope: z.string().optional().describe("The scope of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  rolesAndResponsibilities: z.array(z.object({
    role: z.string().optional().describe("The role or responsibility"),
    responsibility: z.string().optional().describe("The description of the role or responsibility"),
    keyPerformanceIndicators: z.array(z.object({
      metric: z.string().optional().describe("The KPI metric"),
      target: z.string().optional().describe("The target value or range for the KPI"),
      frequency: z.string().optional().describe("How often the KPI is measured")
    })).optional().describe("Key performance indicators for the role performing the responsibility"),
  })).optional().describe("The roles and responsibilities section of the SOP, in Markdown format, starting with a level 2 heading (##)"),
  procedure: z.array(z.object({
    step: z.string().describe("The step name and description"),
    timeframe: z.string().describe("Expected duration or deadline for the step"),
    responsible: z.string().describe("Role or person responsible for executing this step"),
    details: z.string().optional().describe("Additional details, requirements, or notes for this step")
  })).optional().describe("The procedure steps, each with timeframe and responsible role"),
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
    description: z.string().optional().describe("A description of the document or template referenced")
  })).optional().describe("A list of document or template references, each containing a title, type, and link"),
});

export type SOPContent = z.infer<typeof sopSchema>;

export async function generateSOPContent(
  client: OpenAI,
  prompt: string,
  sections?: Array<keyof SOPContent>
): Promise<SOPContent | Partial<SOPContent>> {
  // If no sections specified, generate all sections
  const targetSchema = sections
    ? z.object(
      Object.fromEntries(
        sections.map(section => [section, sopSchema.shape[section]])
      )
    )
    : sopSchema;
  const completion = await client.beta.chat.completions.parse({
    messages: [{ role: 'user', content: prompt }],
    model: "gpt-4o-2024-08-06",
    response_format: zodResponseFormat(targetSchema, 'sop_content'),
  });

  const content = completion.choices[0].message.parsed;

  if (!content) {
    throw new Error('No content received from AI');
  }

  return content;
}

export function formatSOPContent(content: SOPContent): string {
  const documentReferences = content.documentReferences ? [
    `## Documents

Documents, checklists, images, diagrams, flowcharts, SOPs, policies, ...\n`,
    content.documentReferences.map((ref) => {
      return `### ${ref.title} \n  - [Link](${ref.link}) \n  - ${ref.description} \n  - Type: ${ref.type}`;
    }).join('\n')
  ] : [];

  const rolesAndResponsibilities = content.rolesAndResponsibilities ? [
    '## Roles and Responsibilities',
    content.rolesAndResponsibilities.map(item => {
      const kpis = item.keyPerformanceIndicators?.map(kpi =>
        `  - ${kpi.metric}: ${kpi.target} (Measured ${kpi.frequency})`
      ).join('\n') || '';
      return `### ${item.role}\n${item.responsibility}\n\nKey Performance Indicators:\n${kpis}`;
    }).join('\n')
  ] : []

  const procedureSection = content.procedure ? [
    '## Procedure',
    content.procedure.map(step => 
      `### ${step.step}\n**Timeframe**: ${step.timeframe}\n**Responsible**: ${step.responsible}\n\n${step.details || ''}`
    ).join('\n\n')
  ] : [];

  return [
    `# ${content.title || 'Standard Operating Procedure'}`,
    content.purpose,
    content.scope,
    rolesAndResponsibilities.join('\n'),
    procedureSection.join('\n\n'),
    documentReferences.join('\n')
  ].join('\n\n');
}
