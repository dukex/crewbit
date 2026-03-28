export interface Issue {
  key: string;
  summary: string;
  status: string;
}

export interface Comment {
  body: string;
}

export interface IssueProvider {
  getIssuesByStatus(statusLabel: string): Promise<Issue[]>;
  getComments(issueKey: string): Promise<Comment[]>;
}

export interface WorkflowConfig {
  provider: string;
  providers: {
    jira?: JiraProviderConfig;
    [key: string]: unknown;
  };
  statuses: Record<string, string>;
  transitions: Record<string, { from: string; to: string }>;
  queue: string[];
  agent: {
    planCommentMarker: string;
  };
  commands: {
    merge: CommandConfig;
    develop: CommandConfig;
  };
  git: {
    defaultBranch: string;
    branchPattern: string;
    slugMaxLength: number;
  };
  pr: {
    mergeStrategy: "squash" | "merge" | "rebase";
    deleteBranchOnMerge: boolean;
    targetBranch: string;
  };
  daemon: {
    waitSeconds: number;
    maxSessionSeconds: number;
    worktreePrefix: string;
  };
}

export interface JiraProviderConfig {
  baseUrl: string;
  projectKey: string;
  projectId: string;
  transitionIds: Record<string, string>;
  issueTypes: Record<string, string>;
}

export interface CommandConfig {
  invoke: string;
}

export type QueueAction =
  | { type: "merge"; issueKey: string }
  | { type: "develop"; issueKey: string }
  | { type: "idle" };
