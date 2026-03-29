# CLI Reference

## Usage

```
crewbit <workflow-file> [options]
```

## Arguments

| Argument          | Description                        |
| ----------------- | ---------------------------------- |
| `<workflow-file>` | Path to a workflow YAML file       |

## Options

| Flag        | Description                                         |
| ----------- | --------------------------------------------------- |
| `--dry-run` | Print what would run without spawning Claude        |
| `--version` | Print the crewbit version and exit                  |
| `--help`    | Show usage information                              |

## Environment variables

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `WAIT_SECONDS`        | Override `daemon.waitSeconds` from the YAML      |
| `MAX_SESSION_SECONDS` | Override `daemon.maxSessionSeconds` from the YAML |
| `JIRA_EMAIL`          | Jira account email (Jira provider)               |
| `JIRA_API_TOKEN`      | Jira API token (Jira provider)                   |
