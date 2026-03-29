import type { IssueProvider, Issue, Comment, GitHubProjectsProviderConfig } from "../types.js";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

interface ProjectItem {
  content: {
    __typename: string;
    number: number;
    title: string;
    repository: { nameWithOwner: string };
    assignees: { nodes: Array<{ login: string }> };
  };
  fieldValueByName: { name: string } | null;
}

interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export class GitHubProjectsProvider implements IssueProvider {
  private readonly token: string;
  private readonly owner: string;
  private readonly projectNumber: number;
  private viewerLogin: string | null = null;

  constructor(config: GitHubProjectsProviderConfig) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    this.token = token;
    this.owner = config.owner;
    this.projectNumber = config.projectNumber;
  }

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const response = await fetch(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };

    if (data.errors?.length) {
      throw new Error(`GitHub GraphQL error: ${data.errors[0].message}`);
    }

    return data.data as T;
  }

  private async getViewerLogin(): Promise<string> {
    if (this.viewerLogin) return this.viewerLogin;
    const data = await this.graphql<{ viewer: { login: string } }>(
      `query { viewer { login } }`,
    );
    this.viewerLogin = data.viewer.login;
    return this.viewerLogin;
  }

  private async fetchAllProjectItems(): Promise<ProjectItem[]> {
    const items: ProjectItem[] = [];
    let cursor: string | null = null;

    do {
      const data = await this.graphql<{
        organization: {
          projectV2: {
            items: { nodes: ProjectItem[]; pageInfo: PageInfo };
          };
        };
      }>(
        `query($owner: String!, $number: Int!, $cursor: String) {
          organization(login: $owner) {
            projectV2(number: $number) {
              items(first: 100, after: $cursor) {
                nodes {
                  fieldValueByName(name: "Status") {
                    ... on ProjectV2ItemFieldSingleSelectValue { name }
                  }
                  content {
                    __typename
                    ... on Issue {
                      number
                      title
                      repository { nameWithOwner }
                      assignees(first: 10) { nodes { login } }
                    }
                  }
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }`,
        { owner: this.owner, number: this.projectNumber, cursor },
      );

      const page = data.organization.projectV2.items;
      items.push(...page.nodes);
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor !== null);

    return items;
  }

  async getIssuesByStatus(statusLabel: string): Promise<Issue[]> {
    const viewerLogin = await this.getViewerLogin();
    const items = await this.fetchAllProjectItems();

    return items
      .filter(
        (item) =>
          item.content.__typename === "Issue" &&
          item.fieldValueByName?.name === statusLabel &&
          item.content.assignees.nodes.some((assignee) => assignee.login === viewerLogin),
      )
      .map((item) => ({
        key: `${item.content.repository.nameWithOwner}#${item.content.number}`,
        summary: item.content.title,
        status: statusLabel,
      }));
  }

  async getComments(issueKey: string): Promise<Comment[]> {
    const match = issueKey.match(/^([^/]+)\/([^#]+)#(\d+)$/);
    if (!match) {
      throw new Error(`Invalid issue key: "${issueKey}". Expected format: owner/repo#number`);
    }
    const [, owner, repo, numberStr] = match;
    const number = parseInt(numberStr, 10);

    const data = await this.graphql<{
      repository: {
        issue: { comments: { nodes: Array<{ body: string }> } };
      };
    }>(
      `query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            comments(first: 100) { nodes { body } }
          }
        }
      }`,
      { owner, repo, number },
    );

    return data.repository.issue.comments.nodes.map((comment) => ({
      body: comment.body,
    }));
  }
}
