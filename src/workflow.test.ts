import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkflowConfig } from "./types.js";
import { resolveNextAction, resolveNextActions } from "./workflow.js";

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

describe("resolveNextActions", () => {
  it("returns empty array when queue is empty", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const actions = await resolveNextActions(config, makeProvider({}), 3, new Set());
    assert.deepEqual(actions, []);
  });

  it("returns up to N actions across transitions", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Done: { from: "Accepted", command: "/merge" },
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const provider = makeProvider({ Accepted: ["JIR-5", "JIR-10"], "To Do": ["JIR-6", "JIR-7"] });
    const actions = await resolveNextActions(config, provider, 3, new Set());
    assert.equal(actions.length, 3);
    assert.equal(actions[0].issueKey, "JIR-5");
    assert.equal(actions[1].issueKey, "JIR-10");
    assert.equal(actions[2].issueKey, "JIR-6");
  });

  it("skips issues that are already locked", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const provider = makeProvider({ "To Do": ["JIR-1", "JIR-2", "JIR-3"] });
    const locked = new Set(["JIR-1", "JIR-3"]);
    const actions = await resolveNextActions(config, provider, 3, locked);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].issueKey, "JIR-2");
  });

  it("returns fewer actions when locked issues reduce available pool", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const provider = makeProvider({ "To Do": ["JIR-1", "JIR-2"] });
    const locked = new Set(["JIR-1", "JIR-2"]);
    const actions = await resolveNextActions(config, provider, 5, locked);
    assert.deepEqual(actions, []);
  });

  it("uses correct prompt for each action", async () => {
    const config: WorkflowConfig = {
      ...baseConfig,
      transitions: {
        Done: { from: "Accepted", command: "/merge", prompt: "Merge {issueKey}" },
        Start: { from: "To Do", command: "/develop" },
      },
    };
    const provider = makeProvider({ Accepted: ["JIR-5"], "To Do": ["JIR-6"] });
    const actions = await resolveNextActions(config, provider, 2, new Set());
    assert.equal(actions.length, 2);
    assert.equal(actions[0].prompt, "Merge JIR-5");
    assert.equal(actions[1].prompt, "/develop JIR-6");
  });
});
