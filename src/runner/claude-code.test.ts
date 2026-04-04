import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueueAction, WorkflowConfig } from "../types.js";
import { resolveNextAction } from "../workflow.js";
import { ClaudeCodeRunner } from "./claude-code.js";

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

describe("ClaudeCodeRunner", () => {
  it("logs and uses prompt for dry-run command", async () => {
    const logs: string[] = [];
    const runner = new ClaudeCodeRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-123",
      command: "/develop",
      prompt: "custom prompt without slash command",
    };

    const result = await runner.run(action, baseConfig, true);

    assert.equal(result, true);
    assert.deepEqual(logs, [
      "[RUN] claude --print 'custom prompt without slash command'",
      "[dry-run] would run: claude --print 'custom prompt without slash command'",
    ]);
  });

  it("uses prompt interpolated from template in dry-run", async () => {
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
    const provider = {
      getIssuesByStatus: async () => [{ key: "JIR-42", summary: "", status: "To Do" }],
      getComments: async () => [],
    };
    const action = await resolveNextAction(config, provider);

    assert.equal(action.type, "run");

    const logs: string[] = [];
    const runner = new ClaudeCodeRunner("/repo", (message) => logs.push(message));
    const result = await runner.run(action, baseConfig, true);

    assert.equal(result, true);
    assert.deepEqual(logs, [
      "[RUN] claude --print 'Execute the command /develop for issue JIR-42 now'",
      "[dry-run] would run: claude --print 'Execute the command /develop for issue JIR-42 now'",
    ]);
  });
});
