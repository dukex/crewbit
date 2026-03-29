import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { GitHubProjectsProviderConfig } from "../types.js";
import { GitHubProjectsProvider } from "./github-projects.js";

const config: GitHubProjectsProviderConfig = {
  owner: "my-org",
  projectNumber: 1,
};

const VIEWER_RESPONSE = {
  data: { viewer: { login: "alice" } },
};

function makeItemsResponse(items: unknown[]) {
  return {
    data: {
      organization: {
        projectV2: {
          items: {
            nodes: items,
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  };
}

function mockFetchSequence(...responses: unknown[]) {
  let callIndex = 0;
  mock.method(globalThis, "fetch", async () => {
    const response = responses[Math.min(callIndex++, responses.length - 1)];
    return {
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => JSON.stringify(response),
    };
  });
}

describe("GitHubProjectsProvider", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
  });

  afterEach(() => {
    mock.restoreAll();
    process.env.GITHUB_TOKEN = undefined;
  });

  describe("constructor", () => {
    it("throws when GITHUB_TOKEN is missing", () => {
      process.env.GITHUB_TOKEN = undefined;
      assert.throws(() => new GitHubProjectsProvider(config), /GITHUB_TOKEN/);
    });
  });

  describe("getIssuesByStatus", () => {
    it("returns issues matching status assigned to the current viewer", async () => {
      const item = {
        content: {
          __typename: "Issue",
          number: 42,
          title: "Fix the bug",
          repository: { nameWithOwner: "my-org/my-repo" },
          assignees: { nodes: [{ login: "alice" }] },
        },
        fieldValueByName: { name: "Todo" },
      };
      mockFetchSequence(VIEWER_RESPONSE, makeItemsResponse([item]));

      const provider = new GitHubProjectsProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 1);
      assert.equal(issues[0].key, "my-org/my-repo#42");
      assert.equal(issues[0].summary, "Fix the bug");
      assert.equal(issues[0].status, "Todo");
    });

    it("excludes issues with a different status", async () => {
      const item = {
        content: {
          __typename: "Issue",
          number: 1,
          title: "In progress issue",
          repository: { nameWithOwner: "my-org/my-repo" },
          assignees: { nodes: [{ login: "alice" }] },
        },
        fieldValueByName: { name: "In Progress" },
      };
      mockFetchSequence(VIEWER_RESPONSE, makeItemsResponse([item]));

      const provider = new GitHubProjectsProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 0);
    });

    it("excludes issues not assigned to the current viewer", async () => {
      const item = {
        content: {
          __typename: "Issue",
          number: 5,
          title: "Bob's issue",
          repository: { nameWithOwner: "my-org/my-repo" },
          assignees: { nodes: [{ login: "bob" }] },
        },
        fieldValueByName: { name: "Todo" },
      };
      mockFetchSequence(VIEWER_RESPONSE, makeItemsResponse([item]));

      const provider = new GitHubProjectsProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 0);
    });

    it("excludes items with no status set", async () => {
      const item = {
        content: {
          __typename: "Issue",
          number: 7,
          title: "Untracked issue",
          repository: { nameWithOwner: "my-org/my-repo" },
          assignees: { nodes: [{ login: "alice" }] },
        },
        fieldValueByName: null,
      };
      mockFetchSequence(VIEWER_RESPONSE, makeItemsResponse([item]));

      const provider = new GitHubProjectsProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 0);
    });

    it("excludes non-Issue content types", async () => {
      const item = {
        content: {
          __typename: "PullRequest",
          number: 10,
          title: "A pull request",
          repository: { nameWithOwner: "my-org/my-repo" },
          assignees: { nodes: [{ login: "alice" }] },
        },
        fieldValueByName: { name: "Todo" },
      };
      mockFetchSequence(VIEWER_RESPONSE, makeItemsResponse([item]));

      const provider = new GitHubProjectsProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 0);
    });

    it("throws on GraphQL errors", async () => {
      mockFetchSequence(VIEWER_RESPONSE, { errors: [{ message: "Project not found" }] });

      const provider = new GitHubProjectsProvider(config);
      await assert.rejects(() => provider.getIssuesByStatus("Todo"), /Project not found/);
    });
  });

  describe("getComments", () => {
    it("returns all comments for a valid issue key", async () => {
      mockFetchSequence({
        data: {
          repository: {
            issue: {
              comments: {
                nodes: [{ body: "First comment" }, { body: "Second comment" }],
              },
            },
          },
        },
      });

      const provider = new GitHubProjectsProvider(config);
      const comments = await provider.getComments("my-org/my-repo#42");

      assert.equal(comments.length, 2);
      assert.equal(comments[0].body, "First comment");
      assert.equal(comments[1].body, "Second comment");
    });

    it("throws on invalid issue key format", async () => {
      const provider = new GitHubProjectsProvider(config);
      await assert.rejects(() => provider.getComments("invalid-key"), /Invalid issue key/);
    });

    it("throws when the API returns a non-ok response", async () => {
      mock.method(globalThis, "fetch", async () => ({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }));

      const provider = new GitHubProjectsProvider(config);
      await assert.rejects(() => provider.getComments("my-org/my-repo#42"), /401/);
    });
  });
});
