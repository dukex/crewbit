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
  prompt?: string;
}

export interface WorkflowConfig {
  provider: string;
  providers: {
    jira?: JiraProviderConfig;
    "github-projects"?: GitHubProjectsProviderConfig;
    [key: string]: unknown;
  };
  runner?: "claude" | "opencode";
  transitions: Record<string, TransitionConfig>;
  agent?: {
    planCommentMarker: string;
  };
  daemon?: {
    waitSeconds: number;
    maxSessionSeconds: number;
    worktreePrefix: string;
  };
  opencode?: OpenCodeConfig;
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
  sortField?: string;
}

export interface OpenCodeProviderConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

export interface OpenCodeServerConfig {
  port?: number;
  hostname?: string;
  cors?: string[];
  mdns?: boolean;
  mdnsDomain?: string;
  start?: boolean;
}

export type OpenCodeConfig = OpenCodeProviderConfig & OpenCodeServerConfig;

export type RunAction = {
  type: "run";
  issueKey: string;
  command?: string;
  prompt: string;
};
export type IdleAction = { type: "idle" };

export type QueueAction = RunAction | IdleAction;
