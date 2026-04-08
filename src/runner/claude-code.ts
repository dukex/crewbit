import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import type { WorkflowConfig } from "../types.js";
import { BaseRunner, type LiveRunContext, type PreparedRunContext } from "./base.js";

export class ClaudeCodeRunner extends BaseRunner {
  protected formatRunLabel(context: PreparedRunContext): string {
    return `claude --print '${context.prompt}'`;
  }

  protected async runDry(context: PreparedRunContext, _config: WorkflowConfig): Promise<boolean> {
    this.log(`[dry-run] would run: claude --print '${context.prompt}'`);
    return true;
  }

  protected async runLive(context: LiveRunContext, _config: WorkflowConfig): Promise<boolean> {
    const childEnv = buildChildEnv();

    return new Promise((resolve) => {
      const tail: string[] = [];
      const maxTail = 50;

      const child = this.spawnClaude(context, childEnv);

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
        if (signal) {
          this.log(`[WARN] Claude killed by signal: ${signal} (timeout=${context.maxSeconds}s)`);
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

  protected spawnClaude(
    context: LiveRunContext,
    env: Record<string, string>,
  ): ChildProcessByStdio<Writable | null, Readable, Readable> {
    return spawn(
      "claude",
      ["--dangerously-skip-permissions", "--no-session-persistence", "--print", context.prompt],
      {
        stdio: ["ignore", "pipe", "pipe"],
        cwd: context.worktree.path,
        env,
        timeout: context.maxSeconds * 1000,
      },
    );
  }
}

function buildChildEnv(): Record<string, string> {
  const blockedEnv = new Set([
    "CLAUDE_CODE_SSE_PORT",
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
