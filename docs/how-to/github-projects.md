# Set up crewbit with GitHub Projects v2

This guide shows how to connect crewbit to a GitHub Projects v2 board so the daemon can pick up issues and spawn Claude Code sessions.

## Prerequisites

- A GitHub Projects v2 board (classic Projects are not supported)
- A GitHub personal access token (PAT) or a fine-grained token with the correct scopes

## Set up the GitHub token

The token must have the following scopes:

- `project` — read and write access to Projects v2
- `read:org` — required when the project belongs to an organization

Export the token before running crewbit:

```bash
export GITHUB_TOKEN=ghp_...
```

crewbit reads this variable at startup. If it is missing the provider throws:

```
GITHUB_TOKEN environment variable is required
```

## Find the project number

Open the project in your browser. The URL contains the number:

```
https://github.com/orgs/my-org/projects/42
```

The value `42` is the `projectNumber` you put in the YAML. For user-owned projects the URL pattern is `github.com/users/my-user/projects/42`.

## Name the status column correctly

crewbit queries the project field named exactly `Status`. The field name is case-sensitive. If your board uses a different name (for example `Column` or `state`) issues will never match and the queue will always be empty.

Rename the field in the project settings to `Status` before running crewbit.

## Write the workflow YAML

```yaml
provider: github-projects

providers:
  github-projects:
    owner: my-org
    projectNumber: 42

transitions:
  Start:
    from: Ready
    command: /develop

daemon:
  waitSeconds: 30
  maxSessionSeconds: 7200
  worktreePrefix: dev-junior

git:
  defaultBranch: main
  branchPattern: "{issueKey}/{slug}"
  slugMaxLength: 40
```

`owner` is the GitHub organization or user login. `from` must match the option name in the `Status` field exactly, including capitalisation.

## Issue key format

crewbit identifies GitHub issues with the key `owner/repo#number`, for example `my-org/backend#123`. This key is passed to the slash command as `$ARGUMENTS`.

## Verify with a dry run

Before running the daemon, confirm crewbit can read the project without spawning Claude:

```bash
crewbit ./workflow.yaml --dry-run
```

A dry run prints which issue would be picked up next, or reports that the queue is empty. No worktrees are created and no Claude sessions are started.

## Error reference

| Error message | Cause |
|---|---|
| `GITHUB_TOKEN environment variable is required` | The `GITHUB_TOKEN` variable is not set in the environment. |
| `GitHub API failed: 401 ...` | The token is invalid, expired, or missing the required scopes. |
| `GitHub GraphQL error: ...` | The GraphQL query was rejected by GitHub — the message contains the reason. Common causes: wrong `owner`, wrong `projectNumber`, or insufficient token scopes. |
