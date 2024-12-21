import { z } from "zod";

export const SOPSchema = z.object({
  title: z.string().describe("The title of the SOP"),
  description: z.string().describe("A brief description of the SOP"),
  businessSystem: z.string().describe("The name of the business system relevant to the SOP"),
  businessContext: z.string().optional().describe("Additional business context relevant to the SOP"),
  keyProcesses: z.array(z.string()).describe("Key processes involved in the SOP"),
  outputPath: z.string().describe("The directory path where the SOP will be saved")
});

export type SOPParams = z.infer<typeof SOPSchema>;
