# How to set up crewbit with GitHub Projects v2

This guide walks you through configuring crewbit to pull work items from a GitHub Projects v2 board and run Claude sessions automatically.

## Prerequisites

- A GitHub personal access token (classic) or a fine-grained token with the scopes below.
- A GitHub Projects v2 board with a **Status** column (see [Status column naming](#status-column-naming)).
- Issues on the project board assigned to the GitHub user associated with `GITHUB_TOKEN`. The GitHub Projects provider only returns issues assigned to that user; unassigned issues or issues assigned to other users will be ignored.
- crewbit installed and working (`crewbit --version`).

## 1. Create a GitHub token

You need a token with the following scopes:

| Scope | Why it is needed |
|---|---|
| `project` | Read project items and field values (classic tokens only offer a combined read/write scope; crewbit only reads) |
| `read:org` | Query organization-owned projects |
| `repo` (or `public_repo` for public repos only) | Read repository issues and issue comments via GraphQL |

For a **classic personal access token**: go to *Settings → Developer settings → Personal access tokens → Tokens (classic)* and check `project`, `read:org`, and `repo` (or `public_repo` if your repos are all public). GitHub does not offer a read-only variant of the `project` scope for classic tokens, but crewbit only reads project data and does not modify projects.

For a **fine-grained token**: go to *Settings → Developer settings → Personal access tokens → Fine-grained tokens*, select the organization or user, and grant **Projects: Read-only** under organization permissions and **Issues: Read-only** and **Metadata: Read-only** under repository permissions.

Export the token:

```sh
export GITHUB_TOKEN=ghp_...
```

## 2. Find the project number

Open your project board in the browser. The URL contains the project number:

- **Organization project:** `https://github.com/orgs/<org>/projects/<number>`
- **User project:** `https://github.com/users/<login>/projects/<number>`

The `<number>` at the end is the value you put in `projectNumber` in the YAML config.

## 3. Status column naming

crewbit reads issue status from the **Status** single-select field of the project board. The field must be named **exactly** `Status` (capital S). If your board uses a different name (e.g. `State` or `Column`), crewbit will not find any issues.

The `from` values in your `transitions` config must match the option names in that Status field exactly, including capitalisation.

## 4. Minimal working YAML

Save this as `crewbit.yaml` (or any name you prefer), filling in your values:

```yaml
provider: github-projects

providers:
  github-projects:
    owner: my-org          # GitHub organization login or personal username
    projectNumber: 42      # Number from the project URL (see step 2)

transitions:
  Start:
    from: Ready            # Status option name on the board
    command: /develop

agent:
  planCommentMarker: "Crewbit plan"

daemon:
  waitSeconds: 30
  maxSessionSeconds: 7200
  worktreePrefix: dev-junior

git:
  defaultBranch: main
  branchPattern: "{issueKey}/{slug}"
  slugMaxLength: 40
```

Required fields under `providers.github-projects`:

| Field | Type | Description |
|---|---|---|
| `owner` | string | GitHub organization login or personal username that owns the project |
| `projectNumber` | integer | Project number from the URL |

## 5. Verify with dry-run

Before running the daemon for real, confirm the config is valid and that crewbit can read your board:

```sh
crewbit --dry-run ./crewbit.yaml
```

A successful dry-run prints the next issue it would work on, or reports that the queue is empty — no Claude session is spawned.

## Error messages and what they mean

| Error message | Meaning and fix |
|---|---|
| `GITHUB_TOKEN environment variable is required` | The `GITHUB_TOKEN` variable is not set in the current shell. Export it before running crewbit. |
| `GitHub API failed: 401 ...` | The token is invalid or expired. Generate a new token and update `GITHUB_TOKEN`. |
| `GitHub API failed: 403 ...` | The token is missing a required scope. Add `project` and/or `read:org` to the token. |
| `GitHub GraphQL error: <message>` | The GitHub GraphQL API returned an error. The message contains the detail; common causes are a misspelled `owner`, a wrong `projectNumber`, or a token that cannot access the project. |
| `Invalid issue key: "<key>". Expected format: owner/repo#number` | crewbit tried to use an issue key that was not in the required `owner/repo#number` format (for example, from the current branch name or a configured pattern). Check your branch naming and `git.branchPattern` (or any manually supplied issue keys) to ensure they produce values like `my-org/my-repo#123`. |
