import { spawn } from "node:child_process";
import type { OpenCodeServerConfig as ServerConfig } from "../../types.js";
import type { Client } from "./client.js";

export function buildOpenCodeServeArgs(config: ServerConfig): string[] {
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

type ServerDelay = (seconds: number) => Promise<void>;
type ServerSpawner = (
  args: string[],
  context: {
    worktreePath: string;
    authUser: string;
    authPassword: string | undefined;
  },
) => ReturnType<typeof spawn>;

export type ServerFactoryOptions = {
  worktreePath: string;
  config: ServerConfig;
  authUser: string;
  authPassword: string | undefined;
  client: Client;
  delay: ServerDelay;
};

export class Server {
  private process: ReturnType<typeof spawn> | null = null;

  constructor(
    private readonly options: {
      config: ServerConfig;
      authUser: string;
      authPassword: string | undefined;
      worktreePath: string;
      client: Client;
      delay: ServerDelay;
      spawnServer?: ServerSpawner;
    },
  ) {}

  getStartArgs(): string[] {
    return buildOpenCodeServeArgs(this.options.config);
  }

  start(): ReturnType<typeof spawn> {
    const args = this.getStartArgs();
    const spawnServer = this.options.spawnServer;
    this.process = spawnServer
      ? spawnServer(args, {
          worktreePath: this.options.worktreePath,
          authUser: this.options.authUser,
          authPassword: this.options.authPassword,
        })
      : this.spawnOpenCodeServer(args);
    return this.process;
  }

  async health(options: {
    maxWaitMs: number;
    signal: AbortSignal;
  }): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < options.maxWaitMs) {
      const healthy = await this.options.client.health(options.signal);
      if (healthy) return true;
      await this.options.delay(0.5);
    }
    this.stop();
    return false;
  }

  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  protected spawnOpenCodeServer(args: string[]): ReturnType<typeof spawn> {
    return spawn("opencode", args, {
      stdio: ["ignore", "ignore", "ignore"],
      cwd: this.options.worktreePath,
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: this.options.authPassword ?? process.env.OPENCODE_SERVER_PASSWORD,
        OPENCODE_SERVER_USERNAME: this.options.authUser,
      },
    });
  }
}

export class ServerFactory {
  constructor(private readonly options?: { spawnServer?: ServerSpawner }) {}

  create(options: ServerFactoryOptions): Server {
    return new Server({
      ...options,
      spawnServer: this.options?.spawnServer,
    });
  }
}

export async function startOpenCodeServerAndWaitHealthy(options: {
  worktreePath: string;
  config: ServerConfig;
  authUser: string;
  authPassword: string | undefined;
  client: Client;
  maxWaitMs: number;
  signal: AbortSignal;
  delay: (seconds: number) => Promise<void>;
}): Promise<{ process: ReturnType<typeof spawn>; healthy: boolean }> {
  const server = new Server({
    worktreePath: options.worktreePath,
    config: options.config,
    authUser: options.authUser,
    authPassword: options.authPassword,
    client: options.client,
    delay: options.delay,
  });
  const process = server.start();
  const healthy = await server.health({
    maxWaitMs: options.maxWaitMs,
    signal: options.signal,
  });
  return { process, healthy };
}
