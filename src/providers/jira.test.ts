import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { JiraProviderConfig } from "../types.js";
import { JiraProvider } from "./jira.js";

const config: JiraProviderConfig = {
  baseUrl: "https://example.atlassian.net",
  projectKey: "PROJ",
  transitionIds: {},
  issueTypes: {},
};

function mockFetch(response: unknown, ok = true, status = 200) {
  mock.method(globalThis, "fetch", async () => ({
    ok,
    status,
    json: async () => response,
    text: async () => (ok ? "" : JSON.stringify(response)),
  }));
}

describe("JiraProvider", () => {
  beforeEach(() => {
    process.env.JIRA_EMAIL = "user@example.com";
    process.env.JIRA_API_TOKEN = "secret-token";
  });

  afterEach(() => {
    mock.restoreAll();
    // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset; assigning undefined leaves the string "undefined" which is truthy
    delete process.env.JIRA_EMAIL;
    // biome-ignore lint/performance/noDelete: same reason as above
    delete process.env.JIRA_API_TOKEN;
  });

  describe("constructor", () => {
    it("throws when JIRA_EMAIL is missing", () => {
      // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset; assigning undefined leaves the string "undefined" which is truthy
      delete process.env.JIRA_EMAIL;
      assert.throws(() => new JiraProvider(config), /JIRA_EMAIL/);
    });

    it("throws when JIRA_API_TOKEN is missing", () => {
      // biome-ignore lint/performance/noDelete: process.env requires delete to truly unset; assigning undefined leaves the string "undefined" which is truthy
      delete process.env.JIRA_API_TOKEN;
      assert.throws(() => new JiraProvider(config), /JIRA_API_TOKEN/);
    });
  });

  describe("getIssuesByStatus", () => {
    it("returns mapped issues on success", async () => {
      mockFetch({
        issues: [
          { key: "PROJ-1", fields: { summary: "First issue", status: { name: "Todo" } } },
          { key: "PROJ-2", fields: { summary: "Second issue", status: { name: "Todo" } } },
        ],
      });

      const provider = new JiraProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 2);
      assert.equal(issues[0].key, "PROJ-1");
      assert.equal(issues[0].summary, "First issue");
      assert.equal(issues[0].status, "Todo");
      assert.equal(issues[1].key, "PROJ-2");
    });

    it("returns empty array when issues field is missing", async () => {
      mockFetch({});

      const provider = new JiraProvider(config);
      const issues = await provider.getIssuesByStatus("Todo");

      assert.equal(issues.length, 0);
    });

    it("throws on non-ok HTTP response", async () => {
      mockFetch("Unauthorized", false, 401);

      const provider = new JiraProvider(config);
      await assert.rejects(() => provider.getIssuesByStatus("Todo"), /Jira search failed: 401/);
    });
  });

  describe("getComments", () => {
    it("returns comments with plain string body", async () => {
      mockFetch({
        comments: [{ body: "  Plain comment  " }, { body: "Another comment" }],
      });

      const provider = new JiraProvider(config);
      const comments = await provider.getComments("PROJ-1");

      assert.equal(comments.length, 2);
      assert.equal(comments[0].body, "Plain comment");
      assert.equal(comments[1].body, "Another comment");
    });

    it("returns comments with ADF document body", async () => {
      mockFetch({
        comments: [
          {
            body: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Hello " },
                    { type: "text", text: "world" },
                  ],
                },
              ],
            },
          },
        ],
      });

      const provider = new JiraProvider(config);
      const comments = await provider.getComments("PROJ-1");

      assert.equal(comments.length, 1);
      assert.equal(comments[0].body, "Hello world");
    });

    it("returns empty array when comments field is missing", async () => {
      mockFetch({});

      const provider = new JiraProvider(config);
      const comments = await provider.getComments("PROJ-1");

      assert.equal(comments.length, 0);
    });

    it("throws on non-ok HTTP response", async () => {
      mockFetch("Not Found", false, 404);

      const provider = new JiraProvider(config);
      await assert.rejects(
        () => provider.getComments("PROJ-1"),
        /Jira getComments failed for PROJ-1: 404/,
      );
    });

    it("handles ADF node with no content (returns empty text)", async () => {
      mockFetch({
        comments: [
          {
            body: {
              type: "doc",
              content: [{ type: "hardBreak" }],
            },
          },
        ],
      });

      const provider = new JiraProvider(config);
      const comments = await provider.getComments("PROJ-1");

      assert.equal(comments.length, 1);
      assert.equal(comments[0].body, "");
    });
  });
});
