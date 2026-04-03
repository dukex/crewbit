import { spawn } from "node:child_process";
import { buildOpenCodeApiUrl, buildOpenCodeCommand, buildOpenCodeServeArgs } from "../opencode.js";
import type { QueueAction, WorkflowConfig } from "../types.js";
import { cleanupWorktree, createWorktree, getWorktreeInfo } from "../worktree.js";
import type { Runner } from "./types.js";

export class OpenCodeRunner implements Runner {
  constructor(
    private readonly repoRoot: string,
    private readonly log: (message: string) => void,
  ) {}

  async run(action: QueueAction, config: WorkflowConfig, dryRun: boolean): Promise<boolean> {
    if (action.type === "idle") return true;

    const { name, arguments: commandArguments } = buildOpenCodeCommand(action);
    const baseUrl = getOpenCodeBaseUrl(config);
    const worktreeInfo = getWorktreeInfo(this.repoRoot, action.issueKey, config);
    const sessionUrl = buildOpenCodeApiUrl(baseUrl, "/session", worktreeInfo.path);
    const maxSeconds = getMaxSessionSeconds(config);
    const authUser = config.opencode?.username ?? config.providers.opencode?.username ?? "opencode";
    const authPassword =
      config.opencode?.password ??
      config.providers.opencode?.password ??
      process.env.OPENCODE_SERVER_PASSWORD;
    const shouldStartServer = config.opencode?.start ?? true;
    let serverProcess: ReturnType<typeof spawn> | null = null;

    this.log(`[RUN] opencode ${name} ${action.issueKey}`);

    if (dryRun) {
      if (shouldStartServer) {
        const args = buildOpenCodeServeArgs(config.opencode ?? {});
        this.log(`[dry-run] would start: opencode ${args.join(" ")}`);
      }
      this.log(
        `[dry-run] would call: ${sessionUrl} -> /session/:id/command ${name} '${commandArguments}'`,
      );
      return true;
    }

    const worktree = createWorktree(this.repoRoot, action.issueKey, config);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), maxSeconds * 1000);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authPassword) {
      const encoded = Buffer.from(`${authUser}:${authPassword}`).toString("base64");
      headers.Authorization = `Basic ${encoded}`;
    }

    try {
      if (shouldStartServer) {
        const args = buildOpenCodeServeArgs(config.opencode ?? {});
        serverProcess = spawn("opencode", args, {
          stdio: ["ignore", "ignore", "ignore"],
          cwd: worktree.path,
          env: {
            ...process.env,
            OPENCODE_SERVER_PASSWORD: authPassword ?? process.env.OPENCODE_SERVER_PASSWORD,
            OPENCODE_SERVER_USERNAME: authUser,
          },
        });
        const healthUrl = buildOpenCodeApiUrl(baseUrl, "/global/health", worktree.path);
        const start = Date.now();
        const maxWaitMs = 15_000;
        let healthy = false;
        while (Date.now() - start < maxWaitMs) {
          try {
            const healthResponse = await fetch(healthUrl, {
              headers,
              signal: controller.signal,
            });
            if (healthResponse.ok) {
              healthy = true;
              break;
            }
          } catch {}
          await sleep(0.5);
        }
        if (!healthy) {
          this.log("[WARN] OpenCode server did not become healthy in time");
          serverProcess.kill();
          cleanupWorktree(this.repoRoot, worktree);
          return false;
        }
      }
      const sessionResponse = await fetch(sessionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: action.issueKey }),
        signal: controller.signal,
      });
      if (!sessionResponse.ok) {
        const body = await sessionResponse.text();
        this.log(`[WARN] OpenCode session create failed: ${sessionResponse.status} ${body}`);
        cleanupWorktree(this.repoRoot, worktree);
        return false;
      }
      const sessionData = (await sessionResponse.json()) as { id: string };
      const commandUrl = buildOpenCodeApiUrl(
        baseUrl,
        `/session/${sessionData.id}/command`,
        worktree.path,
      );
      const commandResponse = await fetch(commandUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          command: name,
          arguments: commandArguments,
        }),
        signal: controller.signal,
      });
      if (!commandResponse.ok) {
        const body = await commandResponse.text();
        this.log(`[WARN] OpenCode command failed: ${commandResponse.status} ${body}`);
        cleanupWorktree(this.repoRoot, worktree);
        return false;
      }
      this.log("[OK] OpenCode command finished cleanly");
      cleanupWorktree(this.repoRoot, worktree);
      return true;
    } catch (error) {
      this.log(
        `[WARN] OpenCode request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      cleanupWorktree(this.repoRoot, worktree);
      return false;
    } finally {
      if (serverProcess) {
        serverProcess.kill();
      }
      clearTimeout(timeout);
    }
  }
}

function getOpenCodeBaseUrl(config: WorkflowConfig): string {
  const baseUrl = config.opencode?.baseUrl ?? config.providers.opencode?.baseUrl;
  if (!baseUrl) {
    throw new Error(
      "workflow.yaml: opencode.baseUrl or providers.opencode.baseUrl is required for runner=opencode",
    );
  }
  return baseUrl.replace(/\/$/, "");
}

function getMaxSessionSeconds(config: WorkflowConfig): number {
  return Number(process.env.MAX_SESSION_SECONDS ?? config.daemon?.maxSessionSeconds ?? 900);
}

async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
