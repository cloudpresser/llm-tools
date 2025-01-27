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

  const summaryPrompt = `Generate a concise summary for a pull request based on the given git diff summary and this user prompt: "${config.userPrompt}". Please provide enough information so that others can review your pull request. Explain the **motivation** for making this change. What existing problem does the pull request solve?`;
  const testPlanPrompt = `Generate a brief test plan for a pull request based on the given git diff summary and this user prompt: "${config.userPrompt}". Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests). Focus primarily on manual test, and only include unit test instructions if there are new tests listed in the diff summary.`;

  const summary = await generateWithAI(summaryPrompt, gitDiff, isSummary, config.mock);
  const testPlan = await generateWithAI(testPlanPrompt, gitDiff, isSummary, config.mock);

  return template
    .replace('<!-- Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->', '')
    .replace('<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->', summary)
    .replace('<!-- Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests) \nFor more details, see: https://gray-smoke-082026a10-docs.centralus.2.azurestaticapps.net/Pull-Request-Policy/PR-Review-Guidelines\n-->', testPlan);
}
