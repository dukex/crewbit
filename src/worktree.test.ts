import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkflowConfig } from "./types.js";
import { getWorktreeInfo } from "./worktree.js";

const baseConfig: WorkflowConfig = {
  provider: "jira",
  providers: {
    jira: {
      baseUrl: "https://example.atlassian.net",
      projectKey: "JIR",
      transitionIds: {},
      issueTypes: {},
    },
  },
  transitions: {},
};

describe("getWorktreeInfo", () => {
  it("sanitizes issue keys for path-safe worktree names", () => {
    const worktree = getWorktreeInfo("/repo", "owner/repo#123", baseConfig);
    assert.equal(worktree.name, "crewbit-owner-repo-123");
    assert.equal(worktree.path, "/repo/.crewbit/worktrees/crewbit-owner-repo-123");
    assert.equal(worktree.branch, "worktree-crewbit-owner-repo-123");
  });

  it("uses git.worktreePrefix when configured", () => {
    const worktree = getWorktreeInfo("/repo", "JIR-42", {
      ...baseConfig,
      git: {
        defaultBranch: "main",
        branchPattern: "",
        slugMaxLength: 50,
        worktreePrefix: "dev-junior",
      },
    });
    assert.equal(worktree.name, "dev-junior-JIR-42");
  });

  it("falls back to daemon.worktreePrefix for backwards compatibility", () => {
    const worktree = getWorktreeInfo("/repo", "JIR-42", {
      ...baseConfig,
      daemon: { waitSeconds: 30, maxSessionSeconds: 900, worktreePrefix: "legacy-bot" },
    });
    assert.equal(worktree.name, "legacy-bot-JIR-42");
  });

  it("git.worktreePrefix takes precedence over daemon.worktreePrefix", () => {
    const worktree = getWorktreeInfo("/repo", "JIR-42", {
      ...baseConfig,
      git: {
        defaultBranch: "main",
        branchPattern: "",
        slugMaxLength: 50,
        worktreePrefix: "new-bot",
      },
      daemon: { waitSeconds: 30, maxSessionSeconds: 900, worktreePrefix: "old-bot" },
    });
    assert.equal(worktree.name, "new-bot-JIR-42");
  });
});
