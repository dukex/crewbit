#!/usr/bin/env tsx
import { spawn } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  loadConfig,
  createProvider,
  resolveNextAction,
} from "./src/workflow.js";
import type { QueueAction, WorkflowConfig } from "./src/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");

function parseArgs(): { configPath: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf("--config");
  const dryRun = args.includes("--dry-run");

  if (configIndex !== -1 && args[configIndex + 1]) {
    return { configPath: resolve(args[configIndex + 1]), dryRun };
  }

  // Default: look for workflow.yaml one level up (e.g. team/dev-junior/workflow.yaml)
  // when run from inside the orchestrator directory.
  // Caller should always pass --config explicitly for clarity.
  throw new Error(
    "Missing required argument: --config <path-to-workflow.yaml>\n" +
      "Example: tsx daemon.ts --config ../dev-junior/workflow.yaml",
  );
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function log(message: string): void {
  console.log(`[${timestamp()}] ${message}`);
}

async function runClaude(
  action: QueueAction,
  config: WorkflowConfig,
  dryRun: boolean,
): Promise<boolean> {
  if (action.type === "idle") return true;

  const cmd = config.commands[action.type];
  const prompt = `${cmd.invoke} ${action.issueKey}`;

  log(`[${action.type.toUpperCase()}] ${action.issueKey}`);

  if (dryRun) {
    log(`[dry-run] would run: claude --print '${prompt}'`);
    return true;
  }

  const maxSeconds = Number(
    process.env.MAX_SESSION_SECONDS ?? config.daemon.maxSessionSeconds,
  );

  return new Promise((resolve) => {
    const tail: string[] = [];
    const MAX_TAIL = 50;

    log(`[DEBUG] HOME=${process.env.HOME} CLAUDE_DIR_EXISTS=${existsSync((process.env.HOME ?? "") + "/.claude")}`);

    // minimal test: no flags that require session init
    const child = spawn(
      "claude",
      ["--print", "say hi"],
      { stdio: ["ignore", "pipe", "pipe"], cwd: REPO_ROOT, env: process.env, timeout: 30000 },
    );

    function recordLine(line: string): void {
      if (tail.length >= MAX_TAIL) tail.shift();
      tail.push(line);
    }

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      for (const line of text.split("\n")) {
        if (line.trim()) recordLine(`[out] ${line}`);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);
      for (const line of text.split("\n")) {
        if (line.trim()) recordLine(`[err] ${line}`);
      }
    });

    child.on("error", (err) => {
      log(`[ERROR] Failed to spawn claude: ${err.message}`);
      resolve(false);
    });

    child.on("close", (code, signal) => {
      if (signal) {
        log(`[WARN] Claude killed by signal: ${signal} (timeout=${maxSeconds}s)`);
        if (tail.length > 0) log(`[TAIL]\n${tail.join("\n")}`);
        resolve(false);
      } else if (code !== 0) {
        log(`[WARN] Claude exited with code ${code}`);
        if (tail.length > 0) log(`[TAIL]\n${tail.join("\n")}`);
        resolve(false);
      } else {
        log(`[OK] Claude session finished cleanly (exit 0)`);
        resolve(true);
      }
    });
  });
}

async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function main(): Promise<void> {
  const { configPath, dryRun } = parseArgs();
  let exp = 1;

  log(`orchestrator starting${dryRun ? " (dry-run)" : ""}`);
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
      const config = await loadConfig(configPath);
      const waitSeconds = Number(
        process.env.WAIT_SECONDS ?? config.daemon.waitSeconds,
      );

      const provider = createProvider(config);
      const action = await resolveNextAction(config, provider);

      if (action.type === "idle") {
        log(
          `Queue empty. Next check in ${waitSeconds * exp}s. (Ctrl+C to stop)`,
        );
        await sleep(waitSeconds * exp);
        exp *= 2;
      } else {
        const ok = await runClaude(action, config, dryRun);
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
