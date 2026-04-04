#!/usr/bin/env tsx
import { resolve } from "node:path";
import { pruneWorktrees } from "./src/prune.js";
import { createRunner } from "./src/runner/index.js";
import { createProvider, loadConfig, resolveNextAction } from "./src/workflow.js";

const REPO_ROOT = process.cwd();

type Args =
  | { subcommand: "daemon"; configPath: string; dryRun: boolean }
  | { subcommand: "prune"; dryRun: boolean };

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.find((arg) => !arg.startsWith("--"));

  if (positional === "prune") {
    return { subcommand: "prune", dryRun };
  }

  if (positional) {
    return { subcommand: "daemon", configPath: resolve(positional), dryRun };
  }

  throw new Error(
    "Usage:\n" +
      "  crewbit <path-to-workflow.yaml> [--dry-run]   start the daemon\n" +
      "  crewbit prune [--dry-run]                     remove stale worktrees and branches",
  );
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.subcommand === "prune") {
    pruneWorktrees(REPO_ROOT, args.dryRun);
    return;
  }

  const { configPath, dryRun } = args;
  let exp = 1;

  log(`crewbit starting${dryRun ? " (dry-run)" : ""}`);
  log(`Config: ${configPath}`);

  process.on("SIGINT", () => {
    log("Stopped.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    log("Stopped.");
    process.exit(0);
  });

  while (true) {
    try {
      exp = Math.min(exp, 10); // Cap backoff at 10x

      const config = await loadConfig(configPath);
      const waitSeconds = Number(process.env.WAIT_SECONDS ?? config.daemon?.waitSeconds ?? 60);

      const provider = createProvider(config);
      const action = await resolveNextAction(config, provider);

      if (action.type === "idle") {
        log(`Queue empty. Next check in ${waitSeconds * exp}s. (Ctrl+C to stop)`);
        await sleep(waitSeconds * exp);
        exp *= 2;
      } else {
        const runner = createRunner(config, REPO_ROOT, log);
        const ok = await runner.run(action, config, dryRun);
        if (ok) {
          exp = 1;
        } else {
          const backoff = waitSeconds * exp;
          log(`Session failed. Backing off ${backoff}s before retry.`);
          await sleep(backoff);
          exp = Math.min(exp * 2, 32);
        }
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
      log("Retrying in 60s...");
      await sleep(60);
    }
  }
}

main();
