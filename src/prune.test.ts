import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterCrewbitWorktrees, parseWorktreeList } from "./prune.js";

const REPO_ROOT = "/home/user/project";

describe("parseWorktreeList", () => {
  it("returns empty array for empty input", () => {
    assert.deepEqual(parseWorktreeList(""), []);
  });

  it("parses a single worktree with a branch", () => {
    const output = [
      "worktree /home/user/project",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
    ].join("\n");

    const result = parseWorktreeList(output);
    assert.equal(result.length, 1);
    assert.equal(result[0].path, "/home/user/project");
    assert.equal(result[0].branch, "main");
  });

  it("parses a detached HEAD worktree as null branch", () => {
    const output = [
      "worktree /home/user/project/.crewbit/worktrees/dev-JIR-1",
      "HEAD def456",
      "detached",
      "",
    ].join("\n");

    const result = parseWorktreeList(output);
    assert.equal(result[0].branch, null);
  });

  it("parses multiple worktrees", () => {
    const output = [
      "worktree /home/user/project",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /home/user/project/.crewbit/worktrees/dev-JIR-1",
      "HEAD def456",
      "branch refs/heads/worktree-dev-JIR-1",
      "",
      "worktree /home/user/project/.crewbit/worktrees/dev-JIR-2",
      "HEAD 789abc",
      "branch refs/heads/worktree-dev-JIR-2",
      "",
    ].join("\n");

    const result = parseWorktreeList(output);
    assert.equal(result.length, 3);
    assert.equal(result[1].path, "/home/user/project/.crewbit/worktrees/dev-JIR-1");
    assert.equal(result[1].branch, "worktree-dev-JIR-1");
    assert.equal(result[2].path, "/home/user/project/.crewbit/worktrees/dev-JIR-2");
  });
});

describe("filterCrewbitWorktrees", () => {
  it("returns empty array when no crewbit worktrees exist", () => {
    const entries = [{ path: REPO_ROOT, branch: "main" }];
    assert.deepEqual(filterCrewbitWorktrees(entries, REPO_ROOT), []);
  });

  it("returns worktrees under .crewbit/worktrees/", () => {
    const entries = [
      { path: REPO_ROOT, branch: "main" },
      {
        path: `${REPO_ROOT}/.crewbit/worktrees/dev-JIR-1`,
        branch: "worktree-dev-JIR-1",
      },
    ];
    const result = filterCrewbitWorktrees(entries, REPO_ROOT);
    assert.equal(result.length, 1);
    assert.equal(result[0].path, `${REPO_ROOT}/.crewbit/worktrees/dev-JIR-1`);
  });

  it("ignores worktrees outside .crewbit/worktrees/", () => {
    const entries = [
      {
        path: "/other/project/.crewbit/worktrees/dev-JIR-1",
        branch: "worktree-dev-JIR-1",
      },
    ];
    assert.deepEqual(filterCrewbitWorktrees(entries, REPO_ROOT), []);
  });

  it("returns multiple crewbit worktrees", () => {
    const entries = [
      { path: REPO_ROOT, branch: "main" },
      {
        path: `${REPO_ROOT}/.crewbit/worktrees/dev-JIR-1`,
        branch: "worktree-dev-JIR-1",
      },
      {
        path: `${REPO_ROOT}/.crewbit/worktrees/dev-JIR-2`,
        branch: "worktree-dev-JIR-2",
      },
    ];
    assert.equal(filterCrewbitWorktrees(entries, REPO_ROOT).length, 2);
  });
});
