import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ClaudeCodeRunner, OpenCodeRunner, createRunner } from "./runner/index.js";
import type { WorkflowConfig } from "./types.js";

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

describe("createRunner", () => {
  it("returns Claude runner by default", () => {
    const runner = createRunner(baseConfig, "/repo", () => {});
    assert.ok(runner instanceof ClaudeCodeRunner);
  });

  it("returns OpenCode runner when configured", () => {
    const runner = createRunner(
      {
        ...baseConfig,
        runner: "opencode",
        opencode: { baseUrl: "http://localhost:4096" },
      },
      "/repo",
      () => {},
    );
    assert.ok(runner instanceof OpenCodeRunner);
  });
});
