import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runDaemonCommand } from "./commands/daemon.js";
import { runPruneCommand } from "./commands/prune.js";
import { runVersionCommand } from "./commands/version.js";

export type CliArgs =
  | { subcommand: "version" }
  | { subcommand: "daemon"; configPath: string; dryRun: boolean }
  | { subcommand: "prune"; dryRun: boolean };

type CliHandlers = {
  daemon: (args: { configPath: string; dryRun: boolean }) => Promise<void>;
  prune: (args: { dryRun: boolean }) => void;
  version: () => void;
};

export function parseArgs(args: string[]): CliArgs {
  if (args.includes("--version")) {
    return { subcommand: "version" };
  }

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

const defaultHandlers: CliHandlers = {
  daemon: runDaemonCommand,
  prune: runPruneCommand,
  version: runVersionCommand,
};

export async function runCli(
  args: string[],
  handlers: CliHandlers = defaultHandlers,
): Promise<void> {
  const parsedArgs = parseArgs(args);

  if (parsedArgs.subcommand === "version") {
    handlers.version();
    return;
  }

  if (parsedArgs.subcommand === "prune") {
    handlers.prune({ dryRun: parsedArgs.dryRun });
    return;
  }

  await handlers.daemon({ configPath: parsedArgs.configPath, dryRun: parsedArgs.dryRun });
}

async function main(): Promise<void> {
  try {
    await runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

const currentModulePath = fileURLToPath(import.meta.url);
const entryScriptPath = process.argv[1] ? resolve(process.argv[1]) : "";

if (entryScriptPath === currentModulePath) {
  void main();
}
