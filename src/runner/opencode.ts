import { spawn } from "node:child_process";
import type { OpenCodeServerConfig, QueueAction, RunAction, WorkflowConfig } from "../types.js";
import { BaseRunner, type LiveRunContext, type PreparedRunContext } from "./base.js";

export class OpenCodeRunner extends BaseRunner {
  protected formatRunLabel(context: PreparedRunContext): string {
    const { name } = buildOpenCodeCommand(context.action);
    return `opencode ${name} ${context.issueKey}`;
  }

  protected async runDry(context: PreparedRunContext, config: WorkflowConfig): Promise<boolean> {
    const { name, arguments: commandArguments } = buildOpenCodeCommand(context.action);
    const baseUrl = getOpenCodeBaseUrl(config);
    const sessionUrl = buildOpenCodeApiUrl(baseUrl, "/session", context.worktreeInfo.path);
    const shouldStartServer = config.opencode?.start ?? true;
    if (shouldStartServer) {
      const args = buildOpenCodeServeArgs(config.opencode ?? {});
      this.log(`[dry-run] would start: opencode ${args.join(" ")}`);
    }
    this.log(
      `[dry-run] would call: ${sessionUrl} -> /session/:id/command ${name} '${commandArguments}'`,
    );
    return true;
  }

  protected async runLive(context: LiveRunContext, config: WorkflowConfig): Promise<boolean> {
    const { name, arguments: commandArguments } = buildOpenCodeCommand(context.action);
    const baseUrl = getOpenCodeBaseUrl(config);
    const sessionUrl = buildOpenCodeApiUrl(baseUrl, "/session", context.worktree.path);
    const authUser = config.opencode?.username ?? config.providers.opencode?.username ?? "opencode";
    const authPassword =
      config.opencode?.password ??
      config.providers.opencode?.password ??
      process.env.OPENCODE_SERVER_PASSWORD;
    const shouldStartServer = config.opencode?.start ?? true;
    let serverProcess: ReturnType<typeof spawn> | null = null;
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
          cwd: context.worktree.path,
          env: {
            ...process.env,
            OPENCODE_SERVER_PASSWORD: authPassword ?? process.env.OPENCODE_SERVER_PASSWORD,
            OPENCODE_SERVER_USERNAME: authUser,
          },
        });
        const healthUrl = buildOpenCodeApiUrl(baseUrl, "/global/health", context.worktree.path);
        const start = Date.now();
        const maxWaitMs = 15_000;
        let healthy = false;
        while (Date.now() - start < maxWaitMs) {
          try {
            const healthResponse = await fetch(healthUrl, {
              headers,
              signal: context.controller.signal,
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
          return false;
        }
      }
      const sessionResponse = await fetch(sessionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: context.issueKey }),
        signal: context.controller.signal,
      });
      if (!sessionResponse.ok) {
        const body = await sessionResponse.text();
        this.log(`[WARN] OpenCode session create failed: ${sessionResponse.status} ${body}`);
        return false;
      }
      const sessionData = (await sessionResponse.json()) as { id: string };
      const commandUrl = buildOpenCodeApiUrl(
        baseUrl,
        `/session/${sessionData.id}/command`,
        context.worktree.path,
      );
      const commandResponse = await fetch(commandUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          command: name,
          arguments: commandArguments,
        }),
        signal: context.controller.signal,
      });
      if (!commandResponse.ok) {
        const body = await commandResponse.text();
        this.log(`[WARN] OpenCode command failed: ${commandResponse.status} ${body}`);
        return false;
      }
      this.log("[OK] OpenCode command finished cleanly");
      return true;
    } catch (error) {
      this.log(
        `[WARN] OpenCode request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      if (serverProcess) {
        serverProcess.kill();
      }
    }
  }
}

export type OpenCodeCommand = {
  name: string;
  arguments: string;
};

export function buildOpenCodeApiUrl(baseUrl: string, path: string, directory?: string): string {
  const url = new URL(baseUrl);
  url.pathname = path.startsWith("/") ? path : `/${path}`;
  if (directory) {
    url.searchParams.set("directory", directory);
  }
  return url.toString();
}

export function buildOpenCodeCommand(action: RunAction): OpenCodeCommand {
  const rawCommand = action.command.trim();
  const commandName = rawCommand.startsWith("/") ? rawCommand.slice(1) : rawCommand;
  const prompt = action.prompt.trim();
  const candidates = rawCommand.startsWith("/")
    ? [rawCommand, commandName]
    : [rawCommand, `/${rawCommand}`];

  for (const prefix of candidates) {
    if (prompt === prefix) {
      return { name: commandName, arguments: "" };
    }
    if (prompt.startsWith(`${prefix} `)) {
      return {
        name: commandName,
        arguments: prompt.slice(prefix.length).trim(),
      };
    }
  }

  return { name: commandName, arguments: prompt };
}

export function buildOpenCodeServeArgs(config: OpenCodeServerConfig): string[] {
  const args: string[] = ["serve"];
  if (typeof config.port === "number") {
    args.push("--port", String(config.port));
  }
  if (config.hostname) {
    args.push("--hostname", config.hostname);
  }
  if (Array.isArray(config.cors)) {
    for (const origin of config.cors) {
      args.push("--cors", origin);
    }
  }
  if (config.mdns) {
    args.push("--mdns");
  }
  if (config.mdnsDomain) {
    args.push("--mdns-domain", config.mdnsDomain);
  }
  return args;
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

async function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
