import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { QueueAction, WorkflowConfig } from "../types.js";
import type { LiveRunContext } from "./base.js";
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
  },
  opencode: {
    baseUrl: "http://localhost:4096",
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
      "[dry-run] would call: http://localhost:4096/session?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-7 then http://localhost:4096/session/:id/command?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-7 with command 'develop' and arguments 'JIR-7'",
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
      "[dry-run] would call: http://localhost:4096/session?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-8 then http://localhost:4096/session/:id/command?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-8 with command 'develop' and arguments ''",
    ]);
  });

  it("supports prompt-only transitions without a command field", async () => {
    const logs: string[] = [];
    const runner = new OpenCodeRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-9",
      prompt: "  /review   JIR-9   --dry-run  ",
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
      "[RUN] opencode --prompt '/review   JIR-9   --dry-run'",
      "[dry-run] would call: http://localhost:4096/session?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-9 then http://localhost:4096/session/:id/message?directory=%2Frepo%2F.crewbit%2Fworktrees%2Fcrewbit-JIR-9 with prompt '/review   JIR-9   --dry-run'",
    ]);
  });

  it("logs full opencode serve args in dry-run", async () => {
    const logs: string[] = [];
    const runner = new OpenCodeRunner("/repo", (message) => logs.push(message));
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-10",
      command: "/develop",
      prompt: "/develop JIR-10",
    };

    const result = await runner.run(
      action,
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          port: 4111,
          hostname: "0.0.0.0",
          cors: ["http://localhost:3000", "https://example.com"],
          mdns: true,
          mdnsDomain: "team.local",
        },
      },
      true,
    );

    assert.equal(result, true);
    assert.equal(
      logs[1],
      "[dry-run] would start: opencode serve --port 4111 --hostname 0.0.0.0 --cors http://localhost:3000 --cors https://example.com --mdns --mdns-domain team.local",
    );
  });

  it("throws when opencode baseUrl is missing", async () => {
    const runner = new OpenCodeRunner("/repo", () => {});
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-11",
      command: "/develop",
      prompt: "/develop JIR-11",
    };

    await assert.rejects(
      () =>
        runner.run(
          action,
          {
            ...baseConfig,
            providers: {
              jira: baseConfig.providers.jira,
            },
            opencode: undefined,
          },
          true,
        ),
      /opencode\.baseUrl is required/,
    );
  });

  it("returns false when server never becomes healthy", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    const processStub = new FakeServerProcess();
    runner.serverProcess = processStub;
    runner.healthTimeoutMs = 1;
    runner.healthAlwaysUnhealthy = true;

    const result = await runner.runLiveForTest(
      createLiveContext({
        command: "/develop",
        prompt: "/develop JIR-12",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: true,
        },
      },
    );

    assert.equal(result, false);
    assert.equal(processStub.killCalls, 1);
    assert.equal(logs[0], "[WARN] OpenCode server did not become healthy in time");
  });

  it("returns false when session creation fails", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    runner.responses.push(new Response("bad request", { status: 400 }));

    const result = await runner.runLiveForTest(
      createLiveContext({
        command: "/develop",
        prompt: "/develop JIR-13",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
    );

    assert.equal(result, false);
    assert.equal(logs[0], "[WARN] OpenCode session create failed: 400 bad request");
  });

  it("returns false when command request fails", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    runner.responses.push(
      new Response(JSON.stringify({ id: "ses-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    runner.responses.push(new Response("command failed", { status: 500 }));

    const result = await runner.runLiveForTest(
      createLiveContext({
        command: "/develop",
        prompt: "/develop JIR-14",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
    );

    assert.equal(result, false);
    assert.equal(logs[0], "[WARN] OpenCode command failed: 500 command failed");
  });

  it("returns false when message request fails", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    runner.responses.push(
      new Response(JSON.stringify({ id: "ses-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    runner.responses.push(new Response("message failed", { status: 422 }));

    const result = await runner.runLiveForTest(
      createLiveContext({
        prompt: "review JIR-15",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
    );

    assert.equal(result, false);
    assert.equal(logs[0], "[WARN] OpenCode prompt failed: 422 message failed");
  });

  it("returns true when command request succeeds", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    runner.responses.push(
      new Response(JSON.stringify({ id: "ses-3" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    runner.responses.push(new Response("ok", { status: 200 }));

    const result = await runner.runLiveForTest(
      createLiveContext({
        command: "/develop",
        prompt: "/develop JIR-16",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
    );

    assert.equal(result, true);
    assert.equal(logs[0], "[OK] OpenCode command finished cleanly");
  });

  it("returns true when message request succeeds", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    runner.responses.push(
      new Response(JSON.stringify({ id: "ses-4" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    runner.responses.push(new Response("ok", { status: 200 }));

    const result = await runner.runLiveForTest(
      createLiveContext({
        prompt: "review JIR-17",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
    );

    assert.equal(result, true);
    assert.equal(logs[0], "[OK] OpenCode prompt finished cleanly");
  });

  it("returns false when request throws", async () => {
    const logs: string[] = [];
    const runner = new TestOpenCodeRunner("/repo", (message) => logs.push(message));
    runner.requestError = new Error("network down");

    const result = await runner.runLiveForTest(
      createLiveContext({
        command: "/develop",
        prompt: "/develop JIR-18",
      }),
      {
        ...baseConfig,
        opencode: {
          baseUrl: "http://localhost:4096",
          start: false,
        },
      },
    );

    assert.equal(result, false);
    assert.equal(logs[0], "[WARN] OpenCode request failed: network down");
  });
});

class FakeServerProcess {
  killCalls = 0;

  kill(): void {
    this.killCalls += 1;
  }
}

class TestOpenCodeRunner extends OpenCodeRunner {
  responses: Response[] = [];
  requestError: Error | null = null;
  serverProcess: FakeServerProcess = new FakeServerProcess();
  healthTimeoutMs = 10;
  healthAlwaysUnhealthy = false;

  async runLiveForTest(context: LiveRunContext, config: WorkflowConfig): Promise<boolean> {
    return this.runLive(context, config);
  }

  protected spawnOpenCodeServer(): ReturnType<typeof import("node:child_process").spawn> {
    return this.serverProcess as unknown as ReturnType<typeof import("node:child_process").spawn>;
  }

  protected request(input: string | URL): Promise<Response> {
    if (this.healthAlwaysUnhealthy && String(input).includes("/global/health")) {
      return Promise.resolve(new Response("not ready", { status: 503 }));
    }
    if (this.requestError) {
      return Promise.reject(this.requestError);
    }
    const nextResponse = this.responses.shift();
    if (!nextResponse) {
      return Promise.resolve(new Response("ok", { status: 200 }));
    }
    return Promise.resolve(nextResponse);
  }

  protected delay(): Promise<void> {
    return Promise.resolve();
  }

  protected getServerHealthTimeoutMs(): number {
    return this.healthTimeoutMs;
  }
}

function createLiveContext(actionInput: {
  command?: string;
  prompt: string;
}): LiveRunContext {
  return {
    action: {
      type: "run",
      issueKey: "JIR-1",
      command: actionInput.command,
      prompt: actionInput.prompt,
    },
    issueKey: "JIR-1",
    prompt: actionInput.prompt,
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
