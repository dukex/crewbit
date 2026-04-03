import type { OpenCodeServerConfig, QueueAction } from "./types.js";

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

export function buildOpenCodeCommand(action: QueueAction): OpenCodeCommand {
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
      return { name: commandName, arguments: prompt.slice(prefix.length).trim() };
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
