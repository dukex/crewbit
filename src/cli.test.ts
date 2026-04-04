import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseArgs, runCli } from "./cli.js";

describe("parseArgs", () => {
  it("returns version subcommand for --version flag", () => {
    const result = parseArgs(["--version"]);
    assert.deepEqual(result, { subcommand: "version" });
  });

  it("returns daemon subcommand for a config path", () => {
    const result = parseArgs(["/path/to/workflow.yaml"]);
    assert.equal(result.subcommand, "daemon");
  });

  it("returns prune subcommand for prune positional", () => {
    const result = parseArgs(["prune"]);
    assert.deepEqual(result, { subcommand: "prune", dryRun: false });
  });

  it("sets dryRun true when --dry-run is present", () => {
    const result = parseArgs(["/path/to/workflow.yaml", "--dry-run"]);
    assert.equal(result.subcommand, "daemon");
    if (result.subcommand === "daemon") {
      assert.equal(result.dryRun, true);
    }
  });

  it("throws when no arguments are provided", () => {
    assert.throws(() => parseArgs([]), /Usage/);
  });
});

describe("runCli", () => {
  it("dispatches daemon command", async () => {
    const called: string[] = [];

    await runCli(["/tmp/workflow.yaml"], {
      daemon: async () => {
        called.push("daemon");
      },
      prune: () => {
        called.push("prune");
      },
      version: () => {
        called.push("version");
      },
    });

    assert.deepEqual(called, ["daemon"]);
  });

  it("dispatches prune command", async () => {
    const called: string[] = [];

    await runCli(["prune"], {
      daemon: async () => {
        called.push("daemon");
      },
      prune: () => {
        called.push("prune");
      },
      version: () => {
        called.push("version");
      },
    });

    assert.deepEqual(called, ["prune"]);
  });

  it("dispatches version command", async () => {
    const called: string[] = [];

    await runCli(["--version"], {
      daemon: async () => {
        called.push("daemon");
      },
      prune: () => {
        called.push("prune");
      },
      version: () => {
        called.push("version");
      },
    });

    assert.deepEqual(called, ["version"]);
  });
});
