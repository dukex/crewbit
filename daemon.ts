#!/usr/bin/env tsx
import { execSync, spawnSync, spawn } from "child_process";
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

function cleanWorktrees(prefix: string): void {
  const cwd = REPO_ROOT;
  try {
    execSync(`rm -rf .claude/worktrees/${prefix}-*`, { cwd, stdio: "inherit" });
    execSync("git worktree prune", { cwd, stdio: "inherit" });
  } catch (e) {
    log(`Warning: failed to clean worktree dirs: ${e instanceof Error ? e.message : String(e)}`);
  }
  // delete orphan branches left behind by previous worktree sessions
  // spawnSync avoids throwing on grep exit 1 (no matches)
  try {
    const listed = spawnSync(
      "git",
      ["branch", "--format=%(refname:short)"],
      { cwd, encoding: "utf8" },
    );
    const branches = (listed.stdout ?? "")
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b.startsWith(`worktree-${prefix}-`));
    if (branches.length > 0) {
      execSync(`git branch -D ${branches.join(" ")}`, { cwd, stdio: "inherit" });
      log(`Deleted ${branches.length} orphan branch(es).`);
    }
  } catch (e) {
    log(`Warning: failed to delete orphan branches: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function runClaude(
  action: QueueAction,
  config: WorkflowConfig,
  dryRun: boolean,
): Promise<boolean> {
  if (action.type === "idle") return true;

  const cmd = config.commands[action.type];
  const worktreeName = `${config.daemon.worktreePrefix}-${action.issueKey}`;
  const ralphCommand = `${cmd.invoke} ${action.issueKey}`;
  const ralphLoop = `/ralph-loop:ralph-loop "${ralphCommand}" --completion-promise "${cmd.completionPromise}" --max-iterations ${cmd.maxIterations}`;

  log(
    `[${action.type.toUpperCase()}] ${action.issueKey} → worktree: ${worktreeName}`,
  );

  if (dryRun) {
    log(
      `[dry-run] would run: claude -w "${worktreeName}" --print '${ralphLoop}'`,
    );
    return true;
  }

  cleanWorktrees(config.daemon.worktreePrefix);

  const maxSeconds = Number(
    process.env.MAX_SESSION_SECONDS ?? config.daemon.maxSessionSeconds,
  );

  return new Promise((resolve) => {
    const tail: string[] = [];
    const MAX_TAIL = 50;

    const child = spawn(
      "timeout",
      [
        String(maxSeconds),
        "claude",
        "--dangerously-skip-permissions",
        "-w",
        worktreeName,
        "--no-session-persistence",
        "--print",
        ralphLoop,
      ],
      { stdio: ["ignore", "inherit", "pipe"], cwd: REPO_ROOT },
    );

    function recordLine(line: string): void {
      if (tail.length >= MAX_TAIL) tail.shift();
      tail.push(line);
    }

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(text);
      for (const line of text.split("\n")) {
        if (line.trim()) recordLine(line);
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
