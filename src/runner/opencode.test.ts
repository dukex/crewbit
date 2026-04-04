import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueueAction, WorkflowConfig } from "../types.js";
import { OpenCodeRunner } from "./opencode.js";

const baseConfig: WorkflowConfig = {
  provider: "jira",
  providers: {
    jira: {
      baseUrl: "https://example.atlassian.net",
      projectKey: "JIR",
      transitionIds: {},
      issueTypes: {},
    },
    opencode: {
      baseUrl: "http://localhost:4096",
    },
  },
  transitions: {},
};

describe("OpenCodeRunner", () => {
  it("logs expected dry-run operations and worktree directory", async () => {
    const logs: string[] = [];
    const runner = new OpenCodeRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-7",
      command: "/develop",
      prompt: "/develop JIR-7",
    };

    const result = await runner.run(action, baseConfig, true);

    assert.equal(result, true);
    assert.deepEqual(logs, [
      "[RUN] opencode develop JIR-7",
      "[dry-run] would start: opencode serve",
      "[dry-run] would call: http://localhost:4096/session?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-7 -> /session/:id/command develop 'JIR-7'",
    ]);
  });

  it("skips server start log when opencode.start is false", async () => {
    const logs: string[] = [];
    const runner = new OpenCodeRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-8",
      command: "develop",
      prompt: "develop",
    };

    const result = await runner.run(
      action,
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
      true,
    );

    assert.equal(result, true);
    assert.deepEqual(logs, [
      "[RUN] opencode develop JIR-8",
      "[dry-run] would call: http://localhost:4096/session?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-8 -> /session/:id/command develop ''",
    ]);
  });
});
