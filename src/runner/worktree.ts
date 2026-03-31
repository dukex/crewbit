import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import type { QueueAction, WorkflowConfig } from "../types.js";

export type WorktreeInfo = {
  name: string;
  path: string;
  branch: string;
};

export function createWorktree(
  repoRoot: string,
  action: QueueAction,
  config: WorkflowConfig,
): WorktreeInfo {
  const worktreeName = `${config.daemon?.worktreePrefix ?? "crewbit"}-${action.issueKey}`;
  const worktreePath = resolve(repoRoot, ".claude/worktrees", worktreeName);
  const worktreeBranch = `worktree-${worktreeName}`;

  try {
    execSync(`git worktree add "${worktreePath}" -b "${worktreeBranch}"`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
  } catch {
    try {
      execSync(`git worktree remove --force "${worktreePath}"`, {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {}
    try {
      execSync(`git branch -D "${worktreeBranch}"`, {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {}
    execSync(`git worktree add "${worktreePath}" -b "${worktreeBranch}"`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
  }

  return { name: worktreeName, path: worktreePath, branch: worktreeBranch };
}

export function cleanupWorktree(repoRoot: string, worktree: WorktreeInfo): void {
  try {
    execSync(`git worktree remove --force "${worktree.path}"`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
  } catch {}
  const listed = spawnSync("git", ["branch", "--format=%(refname:short)"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (
    (listed.stdout ?? "")
      .split("\n")
      .map((b) => b.trim())
      .includes(worktree.branch)
  ) {
    try {
      execSync(`git branch -D "${worktree.branch}"`, {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {}
  }
}
