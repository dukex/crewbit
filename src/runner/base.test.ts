import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueueAction, WorkflowConfig } from "../types.js";
import { BaseRunner, type LiveRunContext, type PreparedRunContext } from "./base.js";

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

class TestRunner extends BaseRunner {
  readonly dryContexts: PreparedRunContext[] = [];
  readonly liveContexts: LiveRunContext[] = [];

  protected formatRunLabel(context: PreparedRunContext): string {
    return `${context.command} :: ${context.prompt}`;
  }

  protected async runDry(context: PreparedRunContext): Promise<boolean> {
    this.dryContexts.push(context);
    return true;
  }

  protected async runLive(context: LiveRunContext): Promise<boolean> {
    this.liveContexts.push(context);
    return true;
  }
}

describe("BaseRunner", () => {
  it("returns immediately for idle actions", async () => {
    const logs: string[] = [];
    const runner = new TestRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = { type: "idle" };

    const result = await runner.run(action, baseConfig, true);

    assert.equal(result, true);
    assert.equal(logs.length, 0);
    assert.equal(runner.dryContexts.length, 0);
    assert.equal(runner.liveContexts.length, 0);
  });

  it("interpolates template placeholders before dry hook", async () => {
    const logs: string[] = [];
    const runner = new TestRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-42",
      command: "/develop",
      prompt: "Execute {command} for issue {issueKey}",
    };

    const result = await runner.run(action, baseConfig, true);

    assert.equal(result, true);
    assert.equal(runner.dryContexts.length, 1);
    assert.equal(runner.dryContexts[0]?.prompt, "Execute /develop for issue JIR-42");
    assert.equal(logs[0], "[RUN] /develop :: Execute /develop for issue JIR-42");
  });

  it("uses default prompt template when prompt is empty", async () => {
    const logs: string[] = [];
    const runner = new TestRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-99",
      command: "/merge",
      prompt: "",
    };

    const result = await runner.run(action, baseConfig, true);

    assert.equal(result, true);
    assert.equal(runner.dryContexts[0]?.prompt, "/merge JIR-99");
    assert.equal(logs[0], "[RUN] /merge :: /merge JIR-99");
  });
});
