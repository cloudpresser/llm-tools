import { WorkItem } from "./WorkItem";

export interface PullRequestParams {
  organization?: string;
  project?: string;
  repositoryId?: string;
  title: string;
  description: string;
  workItems: WorkItem[];
  targetBranch: string;
  sourceBranch: string;
  personalAccessToken?: string;
}
