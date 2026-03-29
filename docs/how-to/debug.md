# Debug a Session That Is Not Picking Up Issues

crewbit is silent when the queue is empty. This guide walks through the most common reasons issues are not picked up and shows how to diagnose each one.

## Step 1 — Run in dry-run mode

Before changing any configuration, use `--dry-run` to confirm crewbit reads your workflow file correctly and reaches the provider without errors:

```bash
crewbit ./your-workflow.yaml --dry-run
```

In dry-run mode crewbit still connects to the issue tracker and evaluates the queue. If it finds an issue it prints what it *would* run instead of spawning Claude. If the queue is empty you will see the queue-empty line. No Claude sessions are started.

## Step 2 — Read the log prefixes

Every line crewbit writes starts with a timestamp followed by a prefix that signals what happened:

| Prefix | Meaning |
|--------|---------|
| `[RUN]` | An issue was found; a Claude session is about to start. |
| `[dry-run]` | Dry-run mode is active; shows the command that *would* run. |
| `[OK]` | The Claude session finished with exit code 0. |
| `[WARN]` | The Claude session exited with a non-zero code or was killed by a timeout signal. A `[TAIL]` block with the last 50 output lines follows. |
| `[TAIL]` | The final lines of stdout/stderr from a failed session. |
| `[ERROR]` | `claude` could not be spawned at all (binary not found, permission error, etc.). |
| *(no prefix)* | Queue-empty or retry messages — e.g. `Queue empty. Next check in 60s.` or `Session failed. Backing off 120s before retry.` or `Error: … Retrying in 60s…` |

If you see only queue-empty lines, the issue tracker connection is working but no issues match the filter. Continue to the sections below.

## Step 3 — Check status string case sensitivity

The `from` value in each transition must **exactly** match the status label in your issue tracker, including capitalisation and spacing.

```yaml
transitions:
  Start:
    from: To Do      # must match the label character-for-character
    command: /develop
```

Open your issue tracker and copy the status label directly from the board column header or issue detail. A mismatch such as `"to do"` vs `"To Do"` produces no error — crewbit simply finds zero issues for that status.

## Step 4 — Check the assignee filter

crewbit only picks up issues **assigned to the authenticated user**. Issues that are unassigned or assigned to someone else are silently skipped.

- **Jira:** the JQL filter appends `AND assignee = currentUser()`. The current user is derived from `JIRA_EMAIL`.
- **GitHub Projects:** crewbit fetches the `viewer.login` for the `GITHUB_TOKEN` and matches it against the issue's assignees list.

Assign the issue to the account whose credentials are in your environment and re-run.

## Step 5 — Manually test Jira credentials

Run this `curl` command to reproduce the exact API call crewbit makes. Replace the placeholders with your values:

```bash
curl -u "you@example.com:YOUR_JIRA_API_TOKEN" \
  "https://your-org.atlassian.net/rest/api/3/search/jql?jql=project%3DKAN%20AND%20status%3D%22To%20Do%22%20AND%20assignee%3DcurrentUser()&maxResults=5&fields=summary,status"
```

A successful response returns a JSON object with an `issues` array. An empty array means no issues match the filter (check status label and assignee). A `401` or `403` means your credentials are wrong or the token lacks the required Jira scopes (`read:jira-work`).

## Step 6 — Manually test GitHub token scopes

Run this GraphQL query to confirm your `GITHUB_TOKEN` is valid and has the required scopes:

```bash
curl -X POST https://api.github.com/graphql \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"query { viewer { login } }"}'
```

Expected response:

```json
{"data":{"viewer":{"login":"your-github-username"}}}
```

If `login` does not match the user assigned to the issue, update `GITHUB_TOKEN` or reassign the issue. For project-level access the token needs the `read:project` scope in addition to `repo`.

## Step 7 — Clean up stale worktrees

crewbit creates a temporary git worktree under `.claude/worktrees/<prefix>-<issueKey>` for each session and removes it when the session ends. If a previous session was interrupted the worktree may be left behind, causing the next run to fail with a `git worktree add` error.

List all worktrees:

```bash
git worktree list
```

Remove a stale entry:

```bash
git worktree remove --force .claude/worktrees/<worktree-name>
git branch -D worktree-<worktree-name>
```

To remove all stale worktrees at once:

```bash
git worktree prune
```
