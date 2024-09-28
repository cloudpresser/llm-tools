import { generateWithAI } from './generateWithAI';

export async function generatePRDescription(gitDiff: string, template: string, isMock: boolean): Promise<string> {
  if (isMock) {
    const mockSummary = "This is a mock summary for the pull request.";
    const mockTestPlan = "This is a mock test plan for the pull request.";

    return template
      .replace('<!-- Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->', '')
      .replace('<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->', mockSummary)
      .replace('<!-- Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests) \nFor more details, see: https://gray-smoke-082026a10-docs.centralus.2.azurestaticapps.net/Pull-Request-Policy/PR-Review-Guidelines\n-->', mockTestPlan);
  }

  const summaryPrompt = `Generate a concise summary for a pull request based on the given git diff. Include the motivation and problem solved.`;
  const testPlanPrompt = `Generate a brief test plan for a pull request based on the given git diff. Include key test areas and any specific commands to run.`;

  const summary = await generateWithAI(summaryPrompt, gitDiff, isMock);
  const testPlan = await generateWithAI(testPlanPrompt, gitDiff, isMock);

  return template
    .replace('<!-- Please provide enough information so that others can review your pull request. The three fields below are mandatory. -->', '')
    .replace('<!-- Explain the **motivation** for making this change. What existing problem does the pull request solve? -->', summary)
    .replace('<!-- Demonstrate the code is solid. Example: How to test the feature in storybook, screenshots / videos if the pull request changes the user interface. The exact commands you ran and their output (for code covered by unit tests) \nFor more details, see: https://gray-smoke-082026a10-docs.centralus.2.azurestaticapps.net/Pull-Request-Policy/PR-Review-Guidelines\n-->', testPlan);
}
