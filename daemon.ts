#!/usr/bin/env tsx
import { execSync, spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pruneWorktrees } from "./src/prune.js";
import type { QueueAction, WorkflowConfig } from "./src/types.js";
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

async function runClaude(
  action: QueueAction,
  config: WorkflowConfig,
  dryRun: boolean,
): Promise<boolean> {
  if (action.type === "idle") return true;

  const prompt = action.prompt;

  log(`[RUN] ${action.command} ${action.issueKey}`);

  if (dryRun) {
    log(`[dry-run] would run: claude --print '${prompt}'`);
    return true;
  }

  const maxSeconds = Number(
    process.env.MAX_SESSION_SECONDS ?? config.daemon?.maxSessionSeconds ?? 900,
  );

  // Strip env vars injected by Claude Code / VSCode that break child claude processes
  const BLOCKED_ENV = new Set([
    "CLAUDE_CODE_SSE_PORT",
    "ANTHROPIC_BASE_URL",
    "NODE_OPTIONS",
    "VSCODE_INSPECTOR_OPTIONS",
    "VSCODE_INJECTION",
  ]);
  const childEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !BLOCKED_ENV.has(k) && !k.startsWith("CLAUDE_CODE_"),
    ),
  );

  // Create an isolated git worktree so Claude works on a separate checkout.
  // -w + --print are incompatible in Claude CLI, so we create the worktree
  // manually and pass cwd instead.
  const worktreeName = `${config.daemon?.worktreePrefix ?? "crewbit"}-${action.issueKey}`;
  const worktreePath = resolve(REPO_ROOT, ".claude/worktrees", worktreeName);
  const worktreeBranch = `worktree-${worktreeName}`;

  try {
    execSync(`git worktree add "${worktreePath}" -b "${worktreeBranch}"`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  } catch {
    // Worktree or branch may already exist from a previous run — remove and retry
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
    } catch {}
    try {
      execSync(`git branch -D "${worktreeBranch}"`, {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
    } catch {}
    execSync(`git worktree add "${worktreePath}" -b "${worktreeBranch}"`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  }

  const cleanupWorktree = () => {
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: REPO_ROOT,
        stdio: "pipe",
      });
    } catch {}
    // Only delete the temp branch — the feature branch (JIR-xxx/...) must stay
    const listed = spawnSync("git", ["branch", "--format=%(refname:short)"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    if (
      (listed.stdout ?? "")
        .split("\n")
        .map((b) => b.trim())
        .includes(worktreeBranch)
    ) {
      try {
        execSync(`git branch -D "${worktreeBranch}"`, {
          cwd: REPO_ROOT,
          stdio: "pipe",
        });
      } catch {}
    }
  };

  return new Promise((resolve) => {
    const tail: string[] = [];
    const MAX_TAIL = 50;

    const child = spawn(
      "claude",
      ["--dangerously-skip-permissions", "--no-session-persistence", "--print", prompt],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: worktreePath,
        env: childEnv,
        timeout: maxSeconds * 1000,
      },
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
      cleanupWorktree();
      if (signal) {
        log(`[WARN] Claude killed by signal: ${signal} (timeout=${maxSeconds}s)`);
        if (tail.length > 0) log(`[TAIL]\n${tail.join("\n")}`);
        resolve(false);
      } else if (code !== 0) {
        log(`[WARN] Claude exited with code ${code}`);
        if (tail.length > 0) log(`[TAIL]\n${tail.join("\n")}`);
        resolve(false);
      } else {
        log("[OK] Claude session finished cleanly (exit 0)");
        resolve(true);
      }
    });
  });
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
