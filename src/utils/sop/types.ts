import { z } from "zod";

export const documentReferenceSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  link: z.string().optional(),
  type: z.enum(['document', 'template', 'SOP', 'policy', 'checklist', 'flowchart', 'diagram', 'image']).optional()
});

export const SOPContentSchema = z.object({
  title: z.string(),
  documentReferences: z.array(documentReferenceSchema),
  purpose: z.string().optional(),
  scope: z.string().optional(),
  rolesAndResponsibilities: z.string().optional(),
  procedure: z.string().optional()
});

export const SOPSchema = z.object({
  title: z.string().describe("The title of the SOP"),
  description: z.string().describe("A brief description of the SOP"),
  businessSystem: z.string().describe("The name of the business system relevant to the SOP"),
  businessContext: z.string().optional().describe("Additional business context relevant to the SOP"),
  keyProcesses: z.array(z.string()).describe("Key processes involved in the SOP"),
  outputPath: z.string().describe("The directory path where the SOP will be saved")
});

export type SOPContent = z.infer<typeof SOPContentSchema>;
export type SOPParams = z.infer<typeof SOPSchema>;
