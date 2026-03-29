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

export interface TransitionConfig {
  from: string;
  command: string;
}

export interface WorkflowConfig {
  provider: string;
  providers: {
    jira?: JiraProviderConfig;
    "github-projects"?: GitHubProjectsProviderConfig;
    [key: string]: unknown;
  };
  transitions: Record<string, TransitionConfig>;
  agent?: {
    planCommentMarker: string;
  };
  daemon?: {
    waitSeconds: number;
    maxSessionSeconds: number;
    worktreePrefix: string;
  };
  git?: {
    defaultBranch: string;
    branchPattern: string;
    slugMaxLength: number;
  };
}

export interface GitHubProjectsProviderConfig {
  owner: string;
  projectNumber: number;
}

export interface JiraProviderConfig {
  baseUrl: string;
  projectKey: string;
  transitionIds: Record<string, string>;
  issueTypes: Record<string, string>;
}

export type QueueAction = { type: "run"; issueKey: string; command: string } | { type: "idle" };
