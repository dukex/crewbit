# Workflow YAML Reference

Full specification of the crewbit workflow configuration file.

## Top-level fields

| Field         | Type   | Required | Description                             |
| ------------- | ------ | -------- | --------------------------------------- |
| `provider`    | string | yes      | Issue provider name (`jira`)            |
| `providers`   | object | yes      | Provider-specific configuration         |
| `runner`      | string | no       | Execution backend (`claude`, `opencode`) |
| `transitions` | object | yes      | Workflow transitions (order = priority) |
| `agent`       | object | no       | Agent behavior settings                 |
| `daemon`      | object | no       | Daemon timing settings                  |
| `opencode`    | object | no       | OpenCode runner settings                |
| `git`         | object | no       | Git branch settings                     |

## `providers.jira`

| Field           | Type   | Required | Default   | Description                                      |
| --------------- | ------ | -------- | --------- | ------------------------------------------------ |
| `baseUrl`       | string | yes      | —         | Jira instance URL                                |
| `projectKey`    | string | yes      | —         | Jira project key (e.g. `JIR`)                    |
| `transitionIds` | object | yes      | —         | Map of logical name → Jira numeric transition ID |
| `issueTypes`    | object | yes      | —         | Map of type name → Jira issue type ID            |
| `sortField`     | string | no       | `updated` | JQL field used in `ORDER BY … DESC`              |

`transitionIds` maps a logical name to the numeric Jira transition ID (e.g. `Start: "21"`). Find IDs via the Jira REST API or project settings.

## `transitions.<name>`

| Field     | Type   | Required | Description                                        |
| --------- | ------ | -------- | -------------------------------------------------- |
| `from`    | string | yes      | Source status to pick issues from                  |
| `command` | string | yes      | Claude Code slash command to run (e.g. `/develop`) |
| `prompt`  | string | no       | Full prompt sent to Claude instead of the default  |

When `prompt` is omitted, crewbit sends `{command} {issueKey}` (e.g. `/develop PROJ-42`).

When `prompt` is set, crewbit interpolates the following placeholders before sending:

| Placeholder  | Replaced with                               |
| ------------ | ------------------------------------------- |
| `{command}`  | The value of the transition's `command` field |
| `{issueKey}` | The issue key from the provider (e.g. `PROJ-42`) |

## `runner`

`runner` selects which execution backend crewbit uses to run each transition.

- `claude` (default) — spawns Claude Code as a child process.
- `opencode` — calls an OpenCode server over HTTP.

## `daemon`

| Field               | Type   | Default | Description                          |
| ------------------- | ------ | ------- | ------------------------------------ |
| `waitSeconds`       | number | 30      | Polling interval when queue is empty |
| `maxSessionSeconds` | number | 7200    | Hard timeout per Claude session      |
| `worktreePrefix`    | string | —       | Prefix for git worktree branch names |

## `opencode`

| Field        | Type     | Default     | Description                                 |
| ------------ | -------- | ----------- | ------------------------------------------- |
| `baseUrl`    | string   | —           | OpenCode server base URL (e.g. `http://localhost:4096`) |
| `username`   | string   | `opencode`  | HTTP basic auth username                    |
| `password`   | string   | —           | HTTP basic auth password                    |
| `port`       | number   | `4096`      | Port to start `opencode serve` with         |
| `hostname`   | string   | `127.0.0.1` | Hostname to start `opencode serve` with     |
| `cors`       | string[] | `[]`        | Additional CORS origins                     |
| `mdns`       | boolean  | `false`     | Enable mDNS discovery                       |
| `mdnsDomain` | string   | `opencode.local` | Custom mDNS domain name                   |
| `start`      | boolean  | `true`      | Start `opencode serve` automatically        |

When `runner: opencode` is used, crewbit creates an isolated git worktree and sends OpenCode API requests with `?directory=<worktree-path>` so each session runs inside that worktree instead of the repository root.

## `git`

| Field           | Type   | Default | Description                       |
| --------------- | ------ | ------- | --------------------------------- |
| `defaultBranch` | string | `main`  | Base branch for new worktrees     |
| `branchPattern` | string | —       | Template for feature branch names |
| `slugMaxLength` | number | 40      | Max chars in the slug portion     |

### `git.branchPattern` tokens

- `{issueKey}`: The issue key from the provider (e.g. `PROJ-42`).
- `{slug}`: A slugified version of the issue title — lowercased, spaces replaced with `-`, truncated to `git.slugMaxLength`.

Example: `feature/{issueKey}/{slug}` → `feature/PROJ-42/fix-login-bug`.

## `agent`

| Field               | Type   | Description                                                                                                                                                                          |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `planCommentMarker` | string | Prefix that identifies a plan comment on the issue. When set, the Claude Code slash command (e.g. `/develop`) will look for a comment with this prefix to use as the execution plan. |

## `providers.github-projects`

| Field           | Type   | Required | Description                        |
| --------------- | ------ | -------- | ---------------------------------- |
| `owner`         | string | yes      | GitHub organization or user login  |
| `projectNumber` | number | yes      | Project number from the GitHub URL |

## Environment variable overrides

| Variable              | Overrides                    |
| --------------------- | ---------------------------- |
| `WAIT_SECONDS`        | `daemon.waitSeconds`         |
| `MAX_SESSION_SECONDS` | `daemon.maxSessionSeconds`   |
| `JIRA_EMAIL`          | Jira account email           |
| `JIRA_API_TOKEN`      | Jira API token               |
| `GITHUB_TOKEN`        | GitHub personal access token |
| `OPENCODE_SERVER_PASSWORD` | OpenCode basic auth password |
