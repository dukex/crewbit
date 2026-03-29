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

## Dry-run mode

Validate your config without spawning Claude:

```bash
crewbit ./dev-junior.yaml --dry-run
```
