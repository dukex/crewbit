import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import type { WorkflowConfig } from "./types.js";

export type WorktreeInfo = {
  name: string;
  path: string;
  branch: string;
};

export function getWorktreeInfo(
  repoRoot: string,
  issueKey: string,
  config: WorkflowConfig,
): WorktreeInfo {
  const sanitizedIssueKey = sanitizeIssueKey(issueKey);
  const worktreeName = `${config.daemon?.worktreePrefix ?? "crewbit"}-${sanitizedIssueKey}`;
  const worktreePath = resolve(repoRoot, ".claude/worktrees", worktreeName);
  const worktreeBranch = `worktree-${worktreeName}`;

  return { name: worktreeName, path: worktreePath, branch: worktreeBranch };
}

export function createWorktree(
  repoRoot: string,
  issueKey: string,
  config: WorkflowConfig,
): WorktreeInfo {
  const worktree = getWorktreeInfo(repoRoot, issueKey, config);

  try {
    execSync(`git worktree add "${worktree.path}" -b "${worktree.branch}"`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
  } catch {
    try {
      execSync(`git worktree remove --force "${worktree.path}"`, {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {}
    try {
      execSync(`git branch -D "${worktree.branch}"`, {
        cwd: repoRoot,
        stdio: "pipe",
      });
    } catch {}
    execSync(`git worktree add "${worktree.path}" -b "${worktree.branch}"`, {
      cwd: repoRoot,
      stdio: "pipe",
    });
  }

  return worktree;
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

function sanitizeIssueKey(issueKey: string): string {
  const sanitized = issueKey.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized.length > 0 ? sanitized : "issue";
}
