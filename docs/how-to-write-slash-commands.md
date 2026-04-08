# How to write a Claude Code slash command for crewbit

This guide shows you how to author the slash commands that crewbit runs on each issue.

---

## Where slash command files live

Claude Code resolves slash commands from `.claude/commands/` in your repository root.
Each command is a Markdown file:

```
your-repo/
└── .claude/
    └── commands/
        ├── develop.md      # invoked as /develop
        ├── merge.md        # invoked as /merge
        └── translate.md    # invoked as /translate
```

The file name (without `.md`) becomes the slash command name.

---

## How crewbit calls Claude

When crewbit picks up an issue it runs:

```sh
claude --dangerously-skip-permissions --no-session-persistence --print "<command> <issueKey>"
```

So if your YAML has:

```yaml
transitions:
  Start:
    from: Ready
    command: /develop
```

and the next issue is `JIR-42`, crewbit runs:

```sh
claude --dangerously-skip-permissions --no-session-persistence --print "/develop JIR-42"
```

**The issue key is always the first positional argument after the command name.**
Your command file must read and use it — otherwise Claude has no idea which issue to work on.

---

## Minimal working example

`.claude/commands/develop.md`:

````markdown
# /develop — Implement work for an issue

The issue key is `$ARGUMENTS`.

- For GitHub-backed workflows it will be a GitHub issue reference like `owner/repo#42`.
- For Jira-backed workflows it will be a Jira issue key like `JIR-42`.

1. Fetch the issue details for your provider:

   **GitHub Issues:**

   ```sh
   gh issue view $ARGUMENTS --json title,body,comments
   ```

   **Jira:**

   ```sh
   curl -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
     -H "Accept: application/json" \
     "$JIRA_BASE_URL/rest/api/3/issue/$ARGUMENTS"
   ```

2. Create a feature branch named after the issue key.
3. Implement what the issue asks for.
4. Open a pull request targeting `main`.
````

`$ARGUMENTS` is a Claude Code built-in that expands to everything after the command name —
in crewbit's case, that is always the issue key.

---

## `agent.planCommentMarker` and plan comments

Your workflow YAML can set:

```yaml
agent:
  planCommentMarker: "Crewbit plan"
```

This is a convention your command uses to store and retrieve a structured plan in the issue's
comment thread, so that re-runs pick up where a previous session left off.

**Writing a plan comment (GitHub Issues):**

```sh
gh issue comment GITHUB-ISSUE-ID --repo owner/repo --body "$(cat <<'EOF'
# Crewbit plan

## Decisions
- **Decision:** use REST API for simplicity  **Why:** avoids GraphQL dependency

## Steps
1. Add endpoint
2. Write tests
3. Open PR
EOF
)"
```

**Reading an existing plan comment (GitHub Issues):**

```sh
gh issue view GITHUB-ISSUE-ID --repo owner/repo --json comments \
  | jq -r '.comments[].body | select(startswith("# Crewbit plan"))'
```

For Jira-backed workflows, use the Jira REST API to add and retrieve comments on the issue identified by `$ARGUMENTS`.

In your command file, instruct Claude to check for an existing plan comment before
re-planning:

```markdown
Fetch all comments and look for one whose body starts with `# Crewbit plan`.

- **Found:** extract the plan and skip to the implementation steps.
- **Not found:** analyse the issue, write the plan, post it as a comment, then implement.
```

---

## Testing a command locally without running the daemon

Run the command directly with `claude --print`:

```sh
claude --print "/develop JIR-42"
```

Or with `--dry-run` via crewbit (no Claude spawned, just prints what would run):

```sh
crewbit ./my-workflow.yaml --dry-run
```

To iterate quickly on the command file itself:

```sh
# Edit .claude/commands/develop.md, then re-run:
claude --print "/develop JIR-42"
```

No daemon, no issue tracker polling. Note that crewbit adds `--dangerously-skip-permissions` and
`--no-session-persistence` when spawning Claude. To match production behaviour exactly:

```sh
claude --dangerously-skip-permissions --no-session-persistence --print "/develop JIR-42"
```

---

## `--dangerously-skip-permissions` implications

crewbit spawns Claude with `--dangerously-skip-permissions`, which disables all interactive
permission prompts. This means Claude will:

- Read and write files without asking.
- Execute shell commands without asking.
- Make network requests (via tools) without asking.

**As the command author you are responsible for:**

- Scoping what Claude is allowed to do. Use explicit instructions like
  _"only push to branches prefixed with `feature/`"_ or _"do not delete files"_.
- Keeping secrets out of the repository. The child process inherits your environment
  except for a small set of blocked vars (`CLAUDE_CODE_SSE_PORT`, `NODE_OPTIONS`, `VSCODE_INSPECTOR_OPTIONS`, `VSCODE_INJECTION`, `CLAUDE_CODE_*`).
- Reviewing the commands you ship. A command file is executable instructions; treat it
  with the same care you give production code.

---

## Idempotency: what happens when Claude runs twice on the same issue

crewbit may run the same command on the same issue more than once — for example, after a
timeout, a crash, or a manual retry. Design your command to be safe to re-run:

- **Check before acting.** Before creating a branch or opening a PR, check whether one
  already exists:
  ```sh
  gh pr list --search "JIR-42" --state all --json number,headRefName
  ```
- **Use the plan comment as a checkpoint.** If a plan comment exists, skip planning and
  jump straight to the next unfinished step.
- **Prefer idempotent operations.** `git checkout existing-branch` is safe; creating a
  duplicate branch is not.
- **Signal completion clearly.** End your command with a distinguishable marker (e.g.
  `DEVELOP_ITERATION_DONE`) so that any orchestration layer can detect a clean finish
  even if crewbit re-queues the issue.
