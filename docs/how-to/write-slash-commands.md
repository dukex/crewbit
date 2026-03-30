# Write a Claude Code slash command for crewbit

This guide explains how to write a slash command that crewbit will invoke when it picks up an issue.

## Where slash command files live

Slash commands are Markdown files stored at `.claude/commands/<name>.md` in your repository. The filename without the `.md` extension is the command name. For example, `.claude/commands/develop.md` registers the `/develop` command.

## How crewbit calls the command

When crewbit picks up an issue it spawns:

```bash
claude --dangerously-skip-permissions --no-session-persistence --print "<prompt>"
```

By default `<prompt>` is `<command> <issueKey>` — for example `/develop PROJ-42`. The issue key arrives as the first positional argument after the command name, so inside the Markdown file `$ARGUMENTS` expands to the issue key.

You can replace the default prompt entirely using the `prompt` field on a transition in the workflow YAML. See [Customise the prompt sent to Claude](./configure-workflow.md#customise-the-prompt-sent-to-claude) for details.

## Write a minimal /develop command

Create `.claude/commands/develop.md`:

```markdown
Implement the issue $ARGUMENTS.

1. Read the issue details from the tracker.
2. Create a feature branch if one does not already exist.
3. Implement the required changes with tests.
4. Commit and push the branch.
5. Move the issue to "In Review" when done.
```

When crewbit picks up issue `my-org/backend#123`, Claude receives:

```
Implement the issue my-org/backend#123.
...
```

## Write plan comments with agent.planCommentMarker

The `agent.planCommentMarker` setting in the workflow YAML defines a prefix string. When a command instructs Claude to post a comment on the issue beginning with that marker, the daemon can later retrieve and act on it via `getComments`.

Workflow YAML:

```yaml
agent:
  planCommentMarker: "CREWBIT-PLAN:"
```

Command instruction (add to the Markdown file):

```markdown
Before starting implementation, post a comment on the issue with the following format:

CREWBIT-PLAN: <short description of your implementation plan>

Begin the comment with "CREWBIT-PLAN:" exactly so tooling can identify it.
```

crewbit calls `provider.getComments(issueKey)` and filters comments whose body starts with the marker. This lets you read Claude's plan from a subsequent transition or command.

## Handle idempotency

crewbit may run the same command more than once on an issue (for example after a daemon restart). The command should be safe to re-enter. A reliable guard is to check whether a feature branch already exists before creating one:

```markdown
Check whether a branch for $ARGUMENTS already exists (git branch -r). If it does, check it out rather than creating a new one. Do not reset or overwrite existing commits.
```

## Understand --dangerously-skip-permissions

crewbit passes `--dangerously-skip-permissions` to every Claude session. This flag removes all interactive permission prompts — Claude can read, write, and execute without confirmation. The command author is therefore responsible for scoping what Claude does. Avoid broad instructions like "do whatever is needed"; prefer explicit, bounded steps.

## Test a command locally

Run a command against a real issue without going through the daemon:

```bash
claude --print "/develop PROJ-123"
```

This spawns a single Claude session in the current directory with the same flags crewbit would use (except `--no-session-persistence`, which you can add if you want identical behaviour). Inspect the output and any files Claude modifies before wiring the command into a running daemon.
