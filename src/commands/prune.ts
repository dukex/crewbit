import { pruneWorktrees } from "../prune.js";

const REPO_ROOT = process.cwd();

export function runPruneCommand(args: { dryRun: boolean }): void {
  pruneWorktrees(REPO_ROOT, args.dryRun);
}
