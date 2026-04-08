# How to run crewbit without git worktrees

Use `git.disable: true` when your task does not involve a locally cloned git repository or when worktree creation is unnecessary overhead.

## When to use this

- **Non-git projects** — the repository uses SVN, Mercurial, or a custom monorepo toolchain that does not support git worktrees.
- **Tasks with no codebase** — writing, research, planning, or data analysis where the agent only needs to call APIs or produce files, not commit code.
- **Remote infrastructure work** — the agent interacts with remote systems (cloud APIs, databases) and there is no local codebase to check out.
- **OpenCode in ephemeral CI containers** — a fresh container already contains a clean checkout; creating a second worktree is redundant.

## Steps

### 1. Add `git.disable` to your workflow file

```yaml
provider: jira

providers:
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: PROJ
    transitionIds:
      start: "21"
      done: "31"
    issueTypes:
      task: "10001"

transitions:
  research:
    from: Ready
    command: /research

git:
  disable: true
```

### 2. Start the daemon as usual

```bash
pnpm start -- ./your-workflow.yaml
```

crewbit will pick up issues and run the agent directly in the directory where the command was started. No worktree branch is created and no cleanup is needed after the session.

## What changes when `git.disable: true`

| Behaviour | Default | With `git.disable: true` |
| --------- | ------- | ------------------------ |
| Working directory for agent | isolated git worktree | cwd where crewbit started |
| Temporary branch created | yes (`crewbit-<issueKey>`) | no |
| Worktree cleaned up after session | yes | n/a |
| `git.worktreePrefix` used | yes | ignored |
| `git.branchPattern` used | yes | ignored |

## Combining with the OpenCode runner

`git.disable` works with both the `claude` and `opencode` runners. For OpenCode, the `?directory=` query parameter sent to the server will point to the cwd instead of a worktree path.

```yaml
runner: opencode

opencode:
  baseUrl: http://localhost:4096

git:
  disable: true
```
