import { spawn } from "node:child_process";
import type { QueueAction, WorkflowConfig } from "../types.js";
import type { Runner } from "./types.js";
import { cleanupWorktree, createWorktree } from "./worktree.js";

export class ClaudeCodeRunner implements Runner {
  constructor(
    private readonly repoRoot: string,
    private readonly log: (message: string) => void,
  ) {}

  async run(action: QueueAction, config: WorkflowConfig, dryRun: boolean): Promise<boolean> {
    if (action.type === "idle") return true;

    const prompt = action.prompt;

    this.log(`[RUN] ${action.command} ${action.issueKey}`);

    if (dryRun) {
      this.log(`[dry-run] would run: claude --print '${prompt}'`);
      return true;
    }

    const maxSeconds = getMaxSessionSeconds(config);
    const childEnv = buildChildEnv();
    const worktree = createWorktree(this.repoRoot, action, config);

    return new Promise((resolve) => {
      const tail: string[] = [];
      const maxTail = 50;

      const child = spawn(
        "claude",
        ["--dangerously-skip-permissions", "--no-session-persistence", "--print", prompt],
        {
          stdio: ["ignore", "pipe", "pipe"],
          cwd: worktree.path,
          env: childEnv,
          timeout: maxSeconds * 1000,
        },
      );

      function recordLine(line: string): void {
        if (tail.length >= maxTail) tail.shift();
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
        this.log(`[ERROR] Failed to spawn claude: ${err.message}`);
        resolve(false);
      });

      child.on("close", (code, signal) => {
        cleanupWorktree(this.repoRoot, worktree);
        if (signal) {
          this.log(`[WARN] Claude killed by signal: ${signal} (timeout=${maxSeconds}s)`);
          if (tail.length > 0) this.log(`[TAIL]\n${tail.join("\n")}`);
          resolve(false);
        } else if (code !== 0) {
          this.log(`[WARN] Claude exited with code ${code}`);
          if (tail.length > 0) this.log(`[TAIL]\n${tail.join("\n")}`);
          resolve(false);
        } else {
          this.log("[OK] Claude session finished cleanly (exit 0)");
          resolve(true);
        }
      });
    });
  }
}

function buildChildEnv(): Record<string, string> {
  const blockedEnv = new Set([
    "CLAUDE_CODE_SSE_PORT",
    "ANTHROPIC_BASE_URL",
    "NODE_OPTIONS",
    "VSCODE_INSPECTOR_OPTIONS",
    "VSCODE_INJECTION",
  ]);
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !blockedEnv.has(key) && !key.startsWith("CLAUDE_CODE_"),
    ),
  ) as Record<string, string>;
}

function getMaxSessionSeconds(config: WorkflowConfig): number {
  return Number(process.env.MAX_SESSION_SECONDS ?? config.daemon?.maxSessionSeconds ?? 900);
}
