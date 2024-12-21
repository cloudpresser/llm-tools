import { SOPParams } from './types';

export async function createPrompt(params: SOPParams, relevantDocs?: string[], webSearchResults?: string) {
  const combinedContext = [relevantDocs?.join("\n\n"), webSearchResults].filter(Boolean).join("\n\n") || "No additional context provided.";

  return `
<prompt>
  <objective>Create a detailed Standard Operating Procedure in Markdown format with appropriate headings and subheadings</objective>
  <context>
    <company>Cloudpresser LLC</company>
    <focus>Standardization, Scalability, AI Integration</focus>
    <description>${params.description}</description>
    <businessSystem>${params.businessSystem}</businessSystem>
    <businessContext>${params.businessContext || "None provided"}</businessContext>
    <keyProcesses>
      ${params.keyProcesses.map(process => `<process>${process}</process>`).join("\n      ")}
    </keyProcesses>
    <relevantDocumentation>
      ${combinedContext}
    </relevantDocumentation>
  </context>
  <sections>
    <section name="Purpose" />
    <section name="Scope" />
    <section name="Roles and Responsibilities" />
    <section name="Procedure">
      <subsection name="Step 1: [Step Name]" />
      <subsection name="Step 2: [Step Name]" />
    </section>
    <section name="Templates" />
    <section name="KPIs" />
    <section name="Approval" />
  </sections>
  <requirements>
    <format>Professional, Clear, Concise</format>
    <style>Standardized Template</style>
    <outputFormat>Output the SOP in Markdown format using appropriate headings and sections</outputFormat>
  </requirements>
</prompt>`;
}
