# Configure a Workflow

This guide shows how to tailor a crewbit workflow file for common scenarios.

## Set transition priority

crewbit processes transitions in declaration order — the first transition with pending issues wins each cycle. Put high-priority work first:

```yaml
transitions:
  Done:
    from: Accepted
    command: /merge
  Start:
    from: To Do
    command: /develop
```

## Adjust polling and timeout

```yaml
daemon:
  waitSeconds: 60        # how long to wait when the queue is empty
  maxSessionSeconds: 3600 # hard timeout per Claude session
```

## Use a custom branch pattern

```yaml
git:
  defaultBranch: main
  branchPattern: "{issueKey}/{slug}"
  slugMaxLength: 40
```

## Customise the prompt sent to Claude

By default, crewbit sends `<command> <issueKey>` to Claude (e.g. `/develop PROJ-42`). Use the `prompt` field on a transition to send a different string:

```yaml
transitions:
  Start:
    from: To Do
    command: /develop
    prompt: "You must execute the command {command} for the issue {issueKey}. Follow the team conventions."
```

Available placeholders:

- `{command}` — replaced with the transition's `command` value.
- `{issueKey}` — replaced with the issue key (e.g. `PROJ-42`).

A custom prompt is useful when you want to include standing instructions that apply to every issue picked up by a transition, without repeating them inside the slash command file itself.

## Dry-run mode

Validate your config without spawning Claude:

```bash
crewbit ./dev-junior.yaml --dry-run
```
