# How crewbit Works

crewbit is a single-process daemon that bridges an issue tracker with Claude Code. This page explains the core loop and the design decisions behind it.

## The core loop

```
loadConfig → createProvider → resolveNextAction → runClaude → repeat
```

1. **Load config** — crewbit reads your workflow YAML once at startup and validates it.
2. **Resolve next action** — transitions are checked in declaration order. The first transition whose `from` status has a pending issue wins. If nothing is ready, crewbit waits and backs off exponentially.
3. **Run Claude** — crewbit creates an isolated git worktree for the issue, then spawns `claude --print <command> <issue-key>` inside it. The worktree is deleted after the session ends; the feature branch Claude created is preserved.
4. **Repeat** — after a successful session crewbit resets the backoff and starts again immediately.

## Transition order = priority

The order you declare transitions in the YAML is the priority queue. If both a "merge" transition and a "develop" transition have pending issues, whichever comes first in the file wins the next cycle. This makes priorities explicit and auditable.

## Worktree isolation

Each Claude session runs in its own `git worktree` checked out on a temporary branch. This means:

- Parallel future sessions (if you run multiple daemons) won't conflict.
- The working directory Claude sees is clean — no leftover state from previous sessions.
- crewbit can safely delete the worktree after the session without affecting the feature branch Claude pushed.

## Backoff strategy

- **Empty queue** — wait time doubles each cycle, capped at 10× the base `waitSeconds`.
- **Failed session** — the failure backoff doubles separately, capped at 32× the base.

This prevents hammering the issue tracker API when there's no work, and gives transient failures time to resolve.

## Blocked environment variables

Before spawning Claude, crewbit strips a set of environment variables that could interfere with the child process: `CLAUDE_CODE_SSE_PORT`, `ANTHROPIC_BASE_URL`, `NODE_OPTIONS`, `VSCODE_*`, and all `CLAUDE_CODE_*` vars. This prevents port conflicts and accidental configuration inheritance.

## The `--dangerously-skip-permissions` trust model

crewbit spawns Claude with `--dangerously-skip-permissions`, which disables Claude Code's interactive permission prompts. This is intentional: unattended daemons cannot respond to prompts.

The tradeoff is that Claude can take any action your shell user can take — reading files, running tests, making commits, calling external APIs. The slash command author is responsible for scoping what Claude does. Keep commands focused and review them before running a daemon in a sensitive environment.

## Per-cycle config reload

The workflow YAML is loaded once at startup and is not re-read between cycles. Restart the daemon to pick up configuration changes.
