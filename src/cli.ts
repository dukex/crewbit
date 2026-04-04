import { resolve } from "node:path";

export type CliArgs =
  | { subcommand: "version" }
  | { subcommand: "daemon"; configPath: string; dryRun: boolean }
  | { subcommand: "prune"; dryRun: boolean };

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
