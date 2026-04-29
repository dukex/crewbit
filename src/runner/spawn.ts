import { type ChildProcess, type SpawnOptions, spawn } from "node:child_process";

const CMD_METACHAR = /[\s"&|<>^()%!`,;=]/;

export function quoteCmdArg(arg: string): string {
  if (arg.length === 0) return '""';
  if (!CMD_METACHAR.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

export function spawnTool(
  command: string,
  args: string[],
  options: SpawnOptions,
  platform: NodeJS.Platform = process.platform,
): ChildProcess {
  if (platform === "win32") {
    const cmdLine = [command, ...args.map(quoteCmdArg)].join(" ");
    return spawn(cmdLine, [], { ...options, shell: true });
  }
  return spawn(command, args, options);
}
