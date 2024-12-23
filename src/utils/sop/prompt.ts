import { SOPParams } from './types';

interface SOPPromptParams extends SOPParams {
  type?: 'generate' | 'improve';
  originalContent?: string;
  message?: string;
  targetPortion?: string;
}

export async function createPrompt(
  params: SOPPromptParams,
  relevantDocs?: string[],
  webSearchResults?: string
) {
  const combinedContext =
    [relevantDocs?.join('\n\n'), webSearchResults].filter(Boolean).join('\n\n') ||
    'No additional context provided.';

  console.log({ combinedContext })
  const procedureInstructions = `
## How to Write a Procedure
A procedure is a step-by-step instruction and actions designed to achieve a specific task or goal.

It outlines the sequence of actions to be taken, specifying who should perform them and when. They ensure tasks are carried out efficiently, consistently, and safely.

You can update procedures regularly and add new details or more steps. They are usually presented in a visual flowchart or written SOP document to guide the team.

For instance, a simple procedure for handling customer inquiries via email can be:

 - Check the company email for inquiries.
 - Take note of any specific details mentioned in the email.
 - Analyze the inquiry and gather necessary information if needed.
 - Draft a clear and polite response addressing the customer’s query.
 - Review the response to ensure it is professional, concise, and free of errors.
 - Click “Send” to reply to the customer’s email promptly.

Similar to procedures, standard operating procedures (SOPs) are detailed documents that provide specific instructions to complete routine operations. While procedures are broader and can encompass various organizational tasks, SOPs are typically more specific, focusing on standardized processes within a particular department or for a specific activity.

A standard operating procedure often includes more detailed guidelines, quality standards, and compliance requirements, ensuring uniformity. They aim to ensure that employees adhere to regulations and avoid mistakes in their daily tasks.

## How to Write a Procedure: Step-by-Step Guide
Writing procedures require you to document business processes or outline a step-by-step guide for a specific task. This section provides a comprehensive, step-by-step guide to help you master the art of procedural writing.

 ### Step 1: Choose a Good Title

A title acts as an identifier for your procedure. You need to make it easy for your team and other relevant stakeholders to find the documented procedure. The title should be clear, concise, and descriptive, summarizing the procedure’s purpose.

A well-chosen title provides immediate insight, guiding users on the procedure’s content and relevance. It should use simple language and keywords relevant to the task, making it easily searchable. For instance, if the procedure is about “how to send an invoice”, the title should have the keyword “invoice.”

This approach boosts searchability and encourages users to engage with the procedure.

 ### Step 2: List the Relevant Materials

Once you have the title, identify and document all the materials necessary to execute the procedure successfully. This comprehensive list should encompass tools, equipment, software, documents, and other resources essential for the task.

For instance, if your procedure is about setting up a printer, your materials will include the downloadable software, A4 or letter-sized paper, ink or toner cartridges, and power cords.

As you list the materials, consider the diverse needs of your audience. You should have a detailed material list accommodating new hires and experienced employees. If applicable, mention safety equipment, ensuring the procedure is executed safely. Regularly update this list to reflect changes in technology or processes.

 ### Step 3: Highlight the Steps for Performing the Procedure

Now that you are ready to write the procedural text, you need to break it down into clear and concise steps. Each step should be specific, action-oriented, and ordered logically. At this stage, you can just list the tasks to make it easy for your employees to read through.

Use simple language and avoid jargon to make it easy to understand. For instance, if your procedure involves editing a blog post, include steps like “check grammar” and “check titles and subheadings.” These sub-steps are important for the team responsible for task execution. In addition, ensure that the steps are not ambiguous to avoid confusion. You don’t need to go into detail here so that anyone can understand the steps at a glance.

 ### Step 4: Describe the Highlighted Steps

Using the list in step 3, you can now go a bit deeper. Provide detailed explanations, context, and relevant tips or warnings for each step. To avoid confusion, give your team more information about each step.

Let’s say the step is to check the grammar on your blog post. Your explanation can include these details.

 - Check the sentence structures, ensuring they are coherent and error-free.
 - Look out for correct punctuation.
 - Run the blog post through a grammar tool or software to catch errors.
 - Preview changes before publishing.

### Step 5: Include Tips, Advice, and Warning

Just because you have provided the procedure steps, it doesn’t mean that there won’t be any errors. However, you can minimize these errors by incorporating valuable tips, advice, and warnings into your procedure. These tips enhance user understanding and safety.

You can provide shortcuts, best practices, or suggestions for smoother execution or more context, explaining the reasoning behind specific steps. Additionally, the warnings highlight potential pitfalls, safety concerns, or common mistakes to guide your team away from errors.

For instance, in a manufacturing company, you can add tips that employees can use to organize the workspace before starting the task. You can also include the rationale behind each step, which can facilitate troubleshooting if issues arise. Lastly, add information about safety gear that needs to be worn when handling chemicals.

 ### Step 6: Add Relevant Media (Flowchart, Images, Video, GIF)

Adding media to your text keeps your audience engaged. Visual elements also enhance the clarity and user engagement of your procedure.

 - Flowcharts break down the steps, especially when you have complex processes.
 - Images provide step-by-step visual cues, offering a clear understanding of specific actions.
 - Videos offer dynamic demonstrations to reduce confusion.
 - GIFs provide concise, repetitive visuals for quick learning.

For example, if you have a cooking procedure for your restaurant, you can include images of ingredient preparation and a flowchart showcasing cooking steps. A video can also demonstrate the techniques for easier understanding. Utilizing varied media ensures your procedure accommodates different learning styles and caters to all your employees.

 ### Step 7: Include a "Documents" Section

Add a "## Documents" header in your SOP to list all relevant documents, templates, and resources. For each document, provide a bullet point with the link or path, and specify the document type, such as "SOP", "checklist", "flowchart", or "image".

For example:

- **SOP**: [Link or path to the SOP document]
- **Checklist**: [Link or path to the checklist]
- **Flowchart**: [Link or path to the flowchart]
- **Image**: [Link or path to the image]

This approach makes it easy for your team to access necessary resources directly from the SOP.

 ### Step 8: Review and Edit

Your procedure may not be perfect on the first try. You have to review and edit it regularly. Before deploying the procedure, involve some employees and key departments in the review process to ensure that it’s clear and accurate. Your team members could identify areas of improvement based on their work.

To reduce the time you commit to editing, you can have your procedure edited by AI if you’re using SweetProcess. This will help you manage your time and ensure you have the most up-to-date documents available to your team.

You can also involve experts and peers in the field to validate the procedure.

Additionally, there may be changes in your industry that need to be incorporated into the company. When this happens, you should review your procedures to ensure you meet the compliance and quality standards.
`;

  if (params.type === 'improve') {
    return `Please provide your response as a JSON object.

  <prompt>
    <objective>Improve the existing Standard Operating Procedure based on the following requirements and return as JSON </objective>
      <guide> ${procedureInstructions} </guide>
      <improvement>
        <message>${params.message}</message>
        ${params.targetPortion
        ? `<targetPortion>${params.targetPortion}</targetPortion>`
        : ''
      }
      </improvement>
      <originalContent>
${params.originalContent}
      </originalContent>
      <context>
        <relevantDocumentation>
${combinedContext}
        </relevantDocumentation>
      </context>
      <requirements>
        <format>Professional, Clear, Concise</format>
        <style>Maintain existing structure while incorporating improvements</style>
        <outputFormat>Markdown(.md)</outputFormat>
      </requirements>
  </prompt>`;
  }

  return `
<prompt>
  <objective>Create a detailed Standard Operating Procedure in Markdown format with appropriate headings and subheadings</objective>
  <guide> ${procedureInstructions} </guide>
  <context>
    <company>Cloudpresser LLC</company>
    <focus>Standardization, Scalability, AI Integration</focus>
    <description>${params.description}</description>
    <businessSystem>${params.businessSystem}</businessSystem>
    <businessContext>${params.businessContext || 'None provided'}</businessContext>
    <keyProcesses>
      ${params.keyProcesses
      .map((process) => `<process>${process}</process>`)
      .join('\n      ')}
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
    <section name="KPIs" />
    <section name="Documents" />
    <section name="FAQ" />
  </sections>
  <requirements>
    <format>Professional, Clear, Concise</format>
    <style>Standardized Template</style>
    <outputFormat>
      Output the SOP in Markdown format using appropriate headings and sections.
      Include a "## Documents" section with bullet points for each document.
      Specify document types as "SOP", "checklist", "flowchart", or "image".
    </outputFormat>
  </requirements>
</prompt>`;
}
