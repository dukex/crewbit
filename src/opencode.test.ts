import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpenCodeCommand, buildOpenCodeServeArgs } from "./opencode.js";
import type { QueueAction } from "./types.js";

describe("buildOpenCodeCommand", () => {
  it("strips leading slash from command and uses remaining prompt as arguments", () => {
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-1",
      command: "/develop",
      prompt: "/develop JIR-1",
    };
    assert.deepEqual(buildOpenCodeCommand(action), {
      name: "develop",
      arguments: "JIR-1",
    });
  });

  it("keeps command name without leading slash", () => {
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-2",
      command: "develop",
      prompt: "develop JIR-2",
    };
    assert.deepEqual(buildOpenCodeCommand(action), {
      name: "develop",
      arguments: "JIR-2",
    });
  });

  it("uses full prompt when it does not start with the command", () => {
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-3",
      command: "/develop",
      prompt: "Execute /develop for JIR-3 now",
    };
    assert.deepEqual(buildOpenCodeCommand(action), {
      name: "develop",
      arguments: "Execute /develop for JIR-3 now",
    });
  });

  it("returns empty arguments when prompt is only the command", () => {
    const action: QueueAction = {
      type: "run",
      issueKey: "JIR-4",
      command: "/merge",
      prompt: "/merge",
    };
    assert.deepEqual(buildOpenCodeCommand(action), {
      name: "merge",
      arguments: "",
    });
  });
});

describe("buildOpenCodeServeArgs", () => {
  it("uses default port and hostname when no overrides are set", () => {
    assert.deepEqual(buildOpenCodeServeArgs({}), ["serve"]);
  });

  it("includes port and hostname when configured", () => {
    assert.deepEqual(buildOpenCodeServeArgs({ port: 4500, hostname: "0.0.0.0" }), [
      "serve",
      "--port",
      "4500",
      "--hostname",
      "0.0.0.0",
    ]);
  });

  it("includes cors and mdns flags", () => {
    assert.deepEqual(
      buildOpenCodeServeArgs({
        cors: ["http://localhost:3000", "https://app.example.com"],
        mdns: true,
        mdnsDomain: "crewbit.local",
      }),
      [
        "serve",
        "--cors",
        "http://localhost:3000",
        "--cors",
        "https://app.example.com",
        "--mdns",
        "--mdns-domain",
        "crewbit.local",
      ],
    );
  });
});
