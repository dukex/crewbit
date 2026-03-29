# Workflow YAML Reference

Full specification of the crewbit workflow configuration file.

## Top-level fields

| Field         | Type   | Required | Description                          |
| ------------- | ------ | -------- | ------------------------------------ |
| `provider`    | string | yes      | Issue provider name (`jira`)         |
| `providers`   | object | yes      | Provider-specific configuration      |
| `transitions` | object | yes      | Workflow transitions (order = priority) |
| `agent`       | object | no       | Agent behavior settings              |
| `daemon`      | object | no       | Daemon timing settings               |
| `git`         | object | no       | Git branch settings                  |

## `providers.jira`

| Field           | Type   | Description                             |
| --------------- | ------ | --------------------------------------- |
| `baseUrl`       | string | Jira instance URL                       |
| `projectKey`    | string | Jira project key (e.g. `KAN`)           |
| `transitionIds` | object | Map of transition name → Jira ID        |
| `issueTypes`    | object | Map of type name → Jira issue type ID   |

## `transitions.<name>`

| Field     | Type   | Description                                  |
| --------- | ------ | -------------------------------------------- |
| `from`    | string | Source status to pick issues from            |
| `command` | string | Claude Code slash command to run (e.g. `/develop`) |

## `daemon`

| Field               | Type   | Default | Description                          |
| ------------------- | ------ | ------- | ------------------------------------ |
| `waitSeconds`       | number | 30      | Polling interval when queue is empty |
| `maxSessionSeconds` | number | 7200    | Hard timeout per Claude session      |
| `worktreePrefix`    | string | —       | Prefix for git worktree branch names |

## `git`

| Field           | Type   | Default | Description                       |
| --------------- | ------ | ------- | --------------------------------- |
| `defaultBranch` | string | `main`  | Base branch for new worktrees     |
| `branchPattern` | string | —       | Template for feature branch names |
| `slugMaxLength` | number | 40      | Max chars in the slug portion     |

## `agent`

| Field                | Type   | Description                                       |
| -------------------- | ------ | ------------------------------------------------- |
| `planCommentMarker`  | string | Prefix that identifies a plan comment on the issue |
