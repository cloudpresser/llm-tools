import { createPullRequest } from '../utils/azureDevops/createPullRequest';
import axios from 'axios';

jest.mock('axios');

describe('createPullRequest', () => {
  it('should create a pull request successfully', async () => {
    const mockResponse = {
      data: {
        pullRequestId: 123
      }
    };
    jest.spyOn(axios, 'post').mockResolvedValue(mockResponse);

    const result = await createPullRequest({
      organization: 'testorg',
      project: 'testproject',
      repositoryId: 'testrepo',
      title: 'Test PR',
      description: 'Test PR',
      workItems: [{ id: 1 }, { id: 2 }],
      targetBranch: 'main',
      sourceBranch: 'feature',
      personalAccessToken: 'test-token'
    });

    expect(result).toBe(123);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('https://dev.azure.com/testorg/testproject/_apis/git/repositories/testrepo/pullrequests'),
      expect.objectContaining({
        sourceRefName: 'refs/heads/feature',
        targetRefName: 'refs/heads/main',
        title: 'Test PR',
        description: 'Test PR',
        workItemRefs: [{ id: 1 }, { id: 2 }]
      }),
      expect.any(Object)
    );
  });

  it('should throw an error when the API call fails', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('API Error'));

    await expect(createPullRequest({
      organization: 'testorg',
      project: 'testproject',
      title: 'test',
      repositoryId: 'testrepo',
      description: 'Test PR',
      workItems: [],
      targetBranch: 'main',
      sourceBranch: 'feature',
      personalAccessToken: 'test-token'
    })).rejects.toThrow('API Error');
  });
});
