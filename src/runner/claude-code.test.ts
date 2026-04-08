import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import type { QueueAction, WorkflowConfig } from "../types.js";
import { resolveNextAction } from "../workflow.js";
import type { LiveRunContext } from "./base.js";
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

  it("returns false when spawn emits error", async () => {
    const logs: string[] = [];
    const runner = new TestClaudeRunner("/repo", (message) => logs.push(message));
    const child = new FakeChildProcess();
    runner.nextChild = child;
    const runPromise = runner.runLiveForTest(createLiveContext("/develop JIR-1"));

    child.emit("error", new Error("spawn failed"));

    const result = await runPromise;
    assert.equal(result, false);
    assert.equal(logs[0], "[ERROR] Failed to spawn claude: spawn failed");
  });

  it("returns false and logs tail when process is killed by signal", async () => {
    const logs: string[] = [];
    const runner = new TestClaudeRunner("/repo", (message) => logs.push(message));
    const child = new FakeChildProcess();
    runner.nextChild = child;
    const runPromise = runner.runLiveForTest(createLiveContext("/develop JIR-2"));

    child.stdout.write("line one\n\nline two\n");
    child.stderr.write("err one\n");
    child.emit("close", 0, "SIGTERM");

    const result = await runPromise;
    assert.equal(result, false);
    assert.equal(logs[0], "[WARN] Claude killed by signal: SIGTERM (timeout=10s)");
    assert.equal(logs[1], "[TAIL]\n[out] line one\n[out] line two\n[err] err one");
  });

  it("returns false on non-zero exit code without tail", async () => {
    const logs: string[] = [];
    const runner = new TestClaudeRunner("/repo", (message) => logs.push(message));
    const child = new FakeChildProcess();
    runner.nextChild = child;
    const runPromise = runner.runLiveForTest(createLiveContext("/develop JIR-3"));

    child.emit("close", 2, null);

    const result = await runPromise;
    assert.equal(result, false);
    assert.deepEqual(logs, ["[WARN] Claude exited with code 2"]);
  });

  it("returns true on clean exit and keeps only last 50 tail lines", async () => {
    const logs: string[] = [];
    const runner = new TestClaudeRunner("/repo", (message) => logs.push(message));
    const child = new FakeChildProcess();
    runner.nextChild = child;
    const runPromise = runner.runLiveForTest(createLiveContext("/develop JIR-4"));

    for (let index = 1; index <= 55; index += 1) {
      child.stdout.write(`line-${index}\n`);
    }
    child.emit("close", 0, null);

    const result = await runPromise;
    assert.equal(result, true);
    assert.deepEqual(logs, ["[OK] Claude session finished cleanly (exit 0)"]);
  });

  it("filters blocked env vars before spawning", async () => {
    const logs: string[] = [];
    const runner = new TestClaudeRunner("/repo", (message) => logs.push(message));
    const child = new FakeChildProcess();
    runner.nextChild = child;

    const originalSsePort = process.env.CLAUDE_CODE_SSE_PORT;
    const originalNodeOptions = process.env.NODE_OPTIONS;
    const originalInspector = process.env.VSCODE_INSPECTOR_OPTIONS;
    const originalInjection = process.env.VSCODE_INJECTION;
    const originalPrefix = process.env.CLAUDE_CODE_CUSTOM_FLAG;
    const originalAllowed = process.env.CREWBIT_ALLOWED_ENV;

    process.env.CLAUDE_CODE_SSE_PORT = "1234";
    process.env.NODE_OPTIONS = "--inspect";
    process.env.VSCODE_INSPECTOR_OPTIONS = "blocked";
    process.env.VSCODE_INJECTION = "blocked";
    process.env.CLAUDE_CODE_CUSTOM_FLAG = "blocked";
    process.env.CREWBIT_ALLOWED_ENV = "allowed";

    try {
      const runPromise = runner.runLiveForTest(createLiveContext("/develop JIR-5"));
      child.emit("close", 0, null);
      const result = await runPromise;

      assert.equal(result, true);
      assert.equal(runner.lastSpawnEnv?.CREWBIT_ALLOWED_ENV, "allowed");
      assert.equal(runner.lastSpawnEnv?.CLAUDE_CODE_SSE_PORT, undefined);
      assert.equal(runner.lastSpawnEnv?.NODE_OPTIONS, undefined);
      assert.equal(runner.lastSpawnEnv?.VSCODE_INSPECTOR_OPTIONS, undefined);
      assert.equal(runner.lastSpawnEnv?.VSCODE_INJECTION, undefined);
      assert.equal(runner.lastSpawnEnv?.CLAUDE_CODE_CUSTOM_FLAG, undefined);
    } finally {
      process.env.CLAUDE_CODE_SSE_PORT = originalSsePort;
      process.env.NODE_OPTIONS = originalNodeOptions;
      process.env.VSCODE_INSPECTOR_OPTIONS = originalInspector;
      process.env.VSCODE_INJECTION = originalInjection;
      process.env.CLAUDE_CODE_CUSTOM_FLAG = originalPrefix;
      process.env.CREWBIT_ALLOWED_ENV = originalAllowed;
    }
  });
});

class FakeChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
}

class TestClaudeRunner extends ClaudeCodeRunner {
  nextChild: FakeChildProcess | null = null;
  lastSpawnEnv: Record<string, string> | null = null;

  async runLiveForTest(context: LiveRunContext): Promise<boolean> {
    return this.runLive(context, baseConfig);
  }

  protected spawnClaude(context: LiveRunContext, env: Record<string, string>) {
    this.lastSpawnEnv = env;
    if (!this.nextChild) {
      throw new Error("No fake child configured");
    }
    return this.nextChild as unknown as ReturnType<ClaudeCodeRunner["spawnClaude"]>;
  }
}

function createLiveContext(prompt: string): LiveRunContext {
  return {
    action: {
      type: "run",
      issueKey: "JIR-1",
      command: "/develop",
      prompt,
    },
    issueKey: "JIR-1",
    prompt,
    maxSeconds: 10,
    controller: new AbortController(),
    worktreeInfo: {
      name: "crewbit-JIR-1",
      path: "/repo/.crewbit/worktrees/crewbit-JIR-1",
      branch: "worktree-crewbit-JIR-1",
    },
    worktree: {
      name: "crewbit-JIR-1",
      path: "/repo/.crewbit/worktrees/crewbit-JIR-1",
      branch: "worktree-crewbit-JIR-1",
    },
  };
}
