import { spawn } from "node:child_process";
import type { WorkflowConfig } from "../../types.js";
import { BaseRunner, type LiveRunContext, type PreparedRunContext } from "../base.js";
import { Client } from "./client.js";
import { Execution } from "./execution.js";
import { type Server, ServerFactory, buildOpenCodeServeArgs } from "./serve.js";

export class OpenCodeRunner extends BaseRunner {
  protected formatRunLabel(context: PreparedRunContext): string {
    const execution = new Execution(context.action);
    if (execution.type === "command") {
      return `opencode ${execution.name} ${context.issueKey}`;
    }
    return `opencode --prompt '${context.prompt}'`;
  }

  protected async runDry(context: PreparedRunContext, config: WorkflowConfig): Promise<boolean> {
    const execution = new Execution(context.action);
    const baseUrl = getOpenCodeBaseUrl(config);
    const dryRunClient = Client.fromConfig({
      config,
      baseUrl,
      directory: context.worktreeInfo.path,
      request: (input, init) => this.request(input, init),
    });
    const sessionUrl = dryRunClient.buildSessionUrl();
    const endpointPath =
      execution.type === "command" ? "/session/:id/command" : "/session/:id/message";
    const executionUrl = dryRunClient.buildUrl(endpointPath);
    const shouldStartServer = config.opencode?.start ?? true;
    if (shouldStartServer) {
      const args = buildOpenCodeServeArgs(config.opencode ?? {});
      this.log(`[dry-run] would start: opencode ${args.join(" ")}`);
    }
    if (execution.type === "command") {
      this.log(
        `[dry-run] would call: ${sessionUrl} then ${executionUrl} with command '${execution.name}' and arguments '${execution.arguments}'`,
      );
      return true;
    }
    this.log(
      `[dry-run] would call: ${sessionUrl} then ${executionUrl} with prompt '${context.prompt}'`,
    );
    return true;
  }

  protected async runLive(context: LiveRunContext, config: WorkflowConfig): Promise<boolean> {
    let server: Server | null = null;

    const baseUrl = getOpenCodeBaseUrl(config);
    const execution = new Execution(context.action);

    const shouldStartServer = config.opencode?.start ?? true;

    const serverFactory = this.createServerFactory();

    const client = Client.fromConfig({
      config,
      baseUrl,
      directory: context.worktree.path,
      request: (input, init) => this.request(input, init),
    });

    try {
      if (shouldStartServer) {
        server = serverFactory.create({
          worktreePath: context.worktree.path,
          config: config.opencode ?? {},
          authUser: client.auth.username,
          authPassword: client.auth.password,
          client,
          delay: (seconds) => this.delay(seconds),
        });
        server.start();
        const healthy = await server.health({
          maxWaitMs: this.getServerHealthTimeoutMs(),
          signal: context.controller.signal,
        });
        if (!healthy) {
          this.log("[WARN] OpenCode server did not become healthy in time");
          return false;
        }
      }
      const sessionResponse = await client.newSession(context.issueKey, context.controller.signal);
      if (!sessionResponse.ok) {
        const body = await sessionResponse.text();
        this.log(`[WARN] OpenCode session create failed: ${sessionResponse.status} ${body}`);
        return false;
      }
      const sessionData = (await sessionResponse.json()) as { id: string };
      if (execution.type === "command") {
        const commandResponse = await client.runCommand(
          sessionData.id,
          execution.name,
          execution.arguments,
          context.controller.signal,
        );
        if (!commandResponse.ok) {
          const body = await commandResponse.text();
          this.log(`[WARN] OpenCode command failed: ${commandResponse.status} ${body}`);
          return false;
        }
        this.log("[OK] OpenCode command finished cleanly");
        return true;
      }

      const messageResponse = await client.sendMessage(
        sessionData.id,
        context.prompt,
        context.controller.signal,
      );
      if (!messageResponse.ok) {
        const body = await messageResponse.text();
        this.log(`[WARN] OpenCode prompt failed: ${messageResponse.status} ${body}`);
        return false;
      }
      this.log("[OK] OpenCode prompt finished cleanly");
      return true;
    } catch (error) {
      this.log(
        `[WARN] OpenCode request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    } finally {
      server?.stop();
    }
  }

  protected spawnOpenCodeServer(
    cwd: string,
    args: string[],
    authUser: string,
    authPassword: string | undefined,
  ): ReturnType<typeof spawn> {
    return this.spawnProcess("opencode", args, {
      stdio: ["ignore", "ignore", "ignore"],
      cwd,
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: authPassword ?? process.env.OPENCODE_SERVER_PASSWORD,
        OPENCODE_SERVER_USERNAME: authUser,
      },
    });
  }

  protected request(input: string | URL, init?: RequestInit): Promise<Response> {
    return fetch(input, init);
  }

  protected delay(seconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  protected getServerHealthTimeoutMs(): number {
    return 15_000;
  }

  protected createServerFactory(): ServerFactory {
    return new ServerFactory({
      spawnServer: (args, context) =>
        this.spawnOpenCodeServer(
          context.worktreePath,
          args,
          context.authUser,
          context.authPassword,
        ),
    });
  }

  protected spawnProcess(
    command: string,
    args: string[],
    options: Parameters<typeof spawn>[2],
  ): ReturnType<typeof spawn> {
    return spawn(command, args, options);
  }
}

function getOpenCodeBaseUrl(config: WorkflowConfig): string {
  const baseUrl = config.opencode?.baseUrl;
  if (!baseUrl) {
    throw new Error("workflow.yaml: opencode.baseUrl is required for runner=opencode");
  }
  return baseUrl.replace(/\/$/, "");
}
