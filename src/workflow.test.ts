import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkflowConfig } from "./types.js";
import { resolveNextAction } from "./workflow.js";

const baseConfig: WorkflowConfig = {
  provider: "jira",
  providers: {
    jira: {
      baseUrl: "https://example.atlassian.net",
      projectKey: "JIR",
      transitionIds: {},
      issueTypes: {},
    },
  },
  transitions: {},
};

function makeProvider(issuesByStatus: Record<string, string[]>) {
  return {
    getIssuesByStatus: async (status: string) =>
      (issuesByStatus[status] ?? []).map((key) => ({ key, summary: "", status })),
    getComments: async () => [],
  };
}

describe("resolveNextAction", () => {
  it("returns idle when queue is empty", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const action = await resolveNextAction(config, makeProvider({}));
    assert.equal(action.type, "idle");
  });

  it("uses default prompt template '{command} {issueKey}' when no prompt is set", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const action = await resolveNextAction(config, makeProvider({ "To Do": ["JIR-1"] }));
    assert.equal(action.type, "run");
    if (action.type === "run") {
      assert.equal(action.prompt, "/develop JIR-1");
    }
  });

  it("interpolates custom prompt template with {command} and {issueKey}", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Start: {
          from: "To Do",
          command: "/develop",
          prompt: "Execute the command {command} for issue {issueKey} now",
        },
      },
    };
    const action = await resolveNextAction(config, makeProvider({ "To Do": ["JIR-42"] }));
    assert.equal(action.type, "run");
    if (action.type === "run") {
      assert.equal(action.prompt, "Execute the command /develop for issue JIR-42 now");
    }
  });

  it("picks the first matching transition when multiple have issues", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Done: { from: "Accepted", command: "/merge" },
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const provider = makeProvider({ Accepted: ["JIR-5"], "To Do": ["JIR-6"] });
    const action = await resolveNextAction(config, provider);
    assert.equal(action.type, "run");
    if (action.type === "run") {
      assert.equal(action.issueKey, "JIR-5");
      assert.equal(action.prompt, "/merge JIR-5");
    }
  });
});
