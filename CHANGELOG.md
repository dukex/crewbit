# 1.0.0 (2026-03-29)


### Bug Fixes

* clean orphan branches in cleanWorktrees + backoff on session failure ([9de6a23](https://github.com/dukex/crewbit/commit/9de6a2311330c22bb7397253c8d16bbf78e1e29f))
* cleanWorktrees now runs from repo root, not orchestrator dir ([543a5fd](https://github.com/dukex/crewbit/commit/543a5fd03d4537a394fde7cb1a392c6b523cd5d8))
* drop worktree (-w) and use --print directly in repo root ([c8f4244](https://github.com/dukex/crewbit/commit/c8f4244393704b0148e6b2020d16df96d359453b))
* pipe prompt via stdin instead of --print to fix -w incompatibility ([76a0017](https://github.com/dukex/crewbit/commit/76a00172ec23392663a3c9165dd88f897e4727bf))
* replace ralph-loop with daemon loop for --print compatibility ([ec35047](https://github.com/dukex/crewbit/commit/ec35047fdc3e04d379582b5f3a61db1e22c68d31))
* restore inherit stdout for TTY + add cwd for repo detection ([18da661](https://github.com/dukex/crewbit/commit/18da661df8fb3ad24b9faaaae62d30af6d90d099))
* restore worktree isolation via manual git worktree add ([59fb75f](https://github.com/dukex/crewbit/commit/59fb75ffe6cf0e619b38939b6ee57d8eed77c6c4))
* strip Claude Code/VSCode env vars that break child claude process ([b9c00b3](https://github.com/dukex/crewbit/commit/b9c00b34d92ee622354b2d89162842bf4c485505))
* surface claude output on failure instead of silent exit code ([9fa0b7e](https://github.com/dukex/crewbit/commit/9fa0b7e04bbfb80514135e8e895e3f181b54479e))
* use /dev/null for daemon stdin to fix ralph-loop exit code 1 ([a4709c9](https://github.com/dukex/crewbit/commit/a4709c984978fc0f92277acf3dc4c924ff1d5794))
* use ESM import for fs instead of require ([979221c](https://github.com/dukex/crewbit/commit/979221cf46557167722fde368672596c81c96b64))
