# How crewbit Works

crewbit is a single-process daemon that bridges an issue tracker with Claude Code. This page explains the core loop and the design decisions behind it.

## The core loop

```
loadConfig → createProvider → resolveNextAction → runClaude → repeat
```

1. **Load config** — crewbit reads your workflow YAML at the start of every cycle.
2. **Resolve next action** — transitions are checked in declaration order. The first transition whose `from` status has a pending issue wins. If nothing is ready, crewbit waits and backs off exponentially.
3. **Run Claude** — crewbit creates an isolated git worktree for the issue, then spawns `claude --print <command> <issue-key>` inside it. The worktree is deleted after the session ends; the feature branch Claude created is preserved.
4. **Repeat** — after a successful session crewbit resets the backoff and starts again immediately.

## Transition order = priority

The order you declare transitions in the YAML is the priority queue. If multiple transitions have pending issues at the same time, whichever is listed first wins the next cycle. This makes priorities explicit and auditable.

**Example — before:**

```yaml
transitions:
  develop:
    from: Ready
    command: /develop
  review:
    from: In review
    command: /review
```

With this config, if both a "Ready" issue and an "In review" issue are waiting, crewbit picks the "Ready" issue and runs `/develop` first.

**After — swapping the order to prioritise reviews:**

```yaml
transitions:
  review:
    from: In review
    command: /review
  develop:
    from: Ready
    command: /develop
```

Now the "In review" issue is processed first, so reviews never queue behind new development work.

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

Before spawning Claude, crewbit strips a specific set of environment variables from the child process's environment to prevent conflicts and accidental configuration inheritance:

| Variable / pattern | Why it is stripped |
| --- | --- |
| `CLAUDE_CODE_SSE_PORT` | The parent Claude session binds to this port for its local server. Inheriting the same port would cause the child Claude process to collide with the parent. |
| `ANTHROPIC_BASE_URL` | Set by some development proxies or testing setups. Inheriting it could silently redirect the child's API calls to the wrong endpoint. |
| `NODE_OPTIONS` | Often set by Node version managers or debugging tools. Flags like `--inspect` or `--require` that make sense for the parent process can crash or hang an unattended child. |
| `VSCODE_INSPECTOR_OPTIONS`, `VSCODE_INJECTION` | Injected by the VS Code integrated terminal. These attach debuggers and load VS Code extensions into spawned processes, which is meaningless and potentially disruptive inside a headless daemon. |
| `CLAUDE_CODE_*` (all) | The full family of Claude Code internal variables. Any of them being inherited by a child Claude instance risks state leakage between the orchestrator and the worker session. |

## The `--dangerously-skip-permissions` trust model

crewbit spawns Claude with `--dangerously-skip-permissions`, which disables Claude Code's interactive permission prompts. This is intentional: unattended daemons cannot respond to prompts.

The tradeoff is that Claude can take any action your shell user can take — reading files, running tests, making commits, calling external APIs. The slash command author is responsible for scoping what Claude does. Keep commands focused and review them before running a daemon in a sensitive environment.

## Per-cycle config reload

The workflow YAML is reloaded on every daemon cycle, before each issue is fetched. This means you can edit your workflow file and the change takes effect on the next poll — no restart required. If the file has a parse error, the cycle fails and crewbit retries after 60 seconds.
