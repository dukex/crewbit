import { execSync } from "node:child_process";
import { resolve } from "node:path";

export interface WorktreeEntry {
  path: string;
  branch: string | null;
}

export function parseWorktreeList(porcelainOutput: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  const blocks = porcelainOutput.trim().split(/\n\n+/);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.trim().split("\n");

    const pathLine = lines.find((line) => line.startsWith("worktree "));
    const branchLine = lines.find((line) => line.startsWith("branch "));

    if (!pathLine) continue;

    const path = pathLine.slice("worktree ".length);
    const branch = branchLine ? branchLine.slice("branch refs/heads/".length) : null;

    entries.push({ path, branch });
  }

  return entries;
}

export function filterCrewbitWorktrees(
  entries: WorktreeEntry[],
  repoRoot: string,
): WorktreeEntry[] {
  const worktreesDir = `${resolve(repoRoot, ".crewbit/worktrees")}/`;
  return entries.filter((entry) => entry.path.startsWith(worktreesDir));
}

export function pruneWorktrees(repoRoot: string, dryRun = false): void {
  const raw = execSync("git worktree list --porcelain", {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const worktrees = filterCrewbitWorktrees(parseWorktreeList(raw), repoRoot);

  if (worktrees.length === 0) {
    console.log("No crewbit worktrees to prune.");
    return;
  }

  for (const wt of worktrees) {
    console.log(`${dryRun ? "[dry-run] would remove" : "Removing"} worktree: ${wt.path}`);
    if (!dryRun) {
      try {
        execSync(`git worktree remove --force "${wt.path}"`, {
          cwd: repoRoot,
          stdio: "pipe",
        });
      } catch {
        console.warn(`  Warning: could not remove worktree (already gone?): ${wt.path}`);
      }
    }

    if (wt.branch) {
      console.log(`${dryRun ? "[dry-run] would delete" : "Deleting"} branch: ${wt.branch}`);
      if (!dryRun) {
        try {
          execSync(`git branch -D "${wt.branch}"`, {
            cwd: repoRoot,
            stdio: "pipe",
          });
        } catch {
          console.warn(`  Warning: could not delete branch (already gone?): ${wt.branch}`);
        }
      }
    }
  }

  if (!dryRun) {
    console.log(`\nPruned ${worktrees.length} worktree(s).`);
  } else {
    console.log(`\n${worktrees.length} worktree(s) would be pruned.`);
  }
}
