import { generateWithAI, getConfig } from '@cloudpresser/shared';

export async function generatePRDescription(gitDiff: string, template: string, isSummary: boolean, isMock: boolean): Promise<string> {
  const config = await getConfig();

  if (isMock) {
    const mockSummary = `This is a mock summary for the pull request. User prompt: ${config.userPrompt}`;

    return template
      .replace('<!-- Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->', '')
      .replace('<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->', mockSummary)
      .replace('<!-- Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests) \nFor more details, see: https://gray-smoke-082026a10-docs.centralus.2.azurestaticapps.net/Pull-Request-Policy/PR-Review-Guidelines\n-->', 'Mock test plan');
  }

  const summaryPrompt = `Based on this git diff summary and user prompt "${config.userPrompt}", generate a concise PR summary that includes:
1. The core changes made (what was changed)
2. The motivation (why it was changed)
3. The problem it solves (impact/benefits)
Keep the summary focused and avoid repeating information.`;

  const testPlanPrompt = `Based on the changes shown in the git diff and user prompt "${config.userPrompt}", create a focused test plan that includes:
1. Key manual testing steps needed to verify the changes
2. Any UI testing requirements (if interface changes are present)
3. Specific test commands to run (only if new tests were added in the diff)
Be specific but concise, avoid redundant information. Keep the testing steps short.`;

  const summary = await generateWithAI(summaryPrompt, gitDiff, isSummary, config.mock);
  const testPlan = await generateWithAI(testPlanPrompt, gitDiff, isSummary, config.mock);

  let description = template
    .replace('<!-- Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->', '')
    .replace('<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->', summary)
    .replace('<!-- Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests) \nFor more details, see: https://gray-smoke-082026a10-docs.centralus.2.azurestaticapps.net/Pull-Request-Policy/PR-Review-Guidelines\n-->', testPlan);

  const refinePrompt = `Please refine and format this pull request description to:
1. Remove any duplicate headers or sections
2. Ensure consistent markdown formatting
3. Use proper heading levels (h2 for main sections, h3 for subsections)
4. Remove any redundant information
5. Make sure the content flows logically
6. Keep the original information but make it more concise and clear

The original template structure was:

${template}

Here's the description to refine:

${description}`;

  const refinedDescription = await generateWithAI(refinePrompt, '', false, config.mock);
  return refinedDescription;
}
