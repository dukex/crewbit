# Debug a crewbit session that is not picking up issues

This guide walks through the steps to diagnose why crewbit is not picking up issues from the tracker.

## Step 1: run a dry run

The fastest first check is to validate the configuration and provider connection without spawning Claude:

```bash
crewbit ./workflow.yaml --dry-run
```

A successful dry run prints the issue that would be picked up next, or reports that the queue is empty. If the dry run itself fails, the error message points to the underlying problem (invalid YAML, missing env var, API authentication failure).

## Step 2: read the log output

crewbit logs to stdout. The prefixes tell you what the daemon is doing:

| Prefix / message | Meaning |
|---|---|
| `[crewbit]` | Daemon lifecycle event — startup, shutdown, config load, session start or end. |
| `Queue empty. Next check in Xs.` | The provider returned no issues matching the `from` status in any transition. The daemon is waiting before polling again. |
| `Session failed` | The Claude process exited with a non-zero code. The daemon will back off before retrying. |

If you see `Queue empty` repeatedly, continue to the steps below to verify credentials and status names.

## Step 3: verify tracker credentials

### Jira

```bash
curl -u email:token https://your-org.atlassian.net/rest/api/3/myself
```

A `200` response with a JSON body confirms the credentials are valid. A `401` means the email or token is wrong. A `403` means the token lacks permission to access the project.

### GitHub Projects

```bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
     https://api.github.com/graphql \
     -d '{"query":"{ viewer { login } }"}'
```

A `200` response with `"login"` in the body confirms the token is valid. A `401` means the token is invalid or expired. If `viewer.login` succeeds but issues are not found, the token may be missing the `project` or `read:org` scopes.

## Step 4: check status string casing

The `from` value in a transition is matched against the status field in the tracker exactly as written, including capitalisation. `Ready` and `ready` are different values.

Open the issue tracker and copy the status name character-for-character into the YAML:

```yaml
transitions:
  Start:
    from: Ready   # must match exactly what the board shows
    command: /develop
```

## Step 5: check the assignee

crewbit only returns issues assigned to the authenticated user:

- **Jira** — issues must be assigned to the account identified by `JIRA_EMAIL`.
- **GitHub Projects** — issues must be assigned to the GitHub user whose token is in `GITHUB_TOKEN`.

If an issue is unassigned or assigned to someone else, it will not appear in the queue even if the status matches.

## Step 6: inspect the worktrees directory

crewbit creates worktrees under `.crewbit/worktrees/` inside the repository. If a previous session was interrupted, stale worktree entries can be left behind. They do not block new sessions, but they consume disk space and can cause confusion.

List existing worktrees:

```bash
git worktree list
```

Remove a specific stale entry:

```bash
git worktree remove .crewbit/worktrees/<name>
```

Prune all entries whose directories no longer exist:

```bash
git worktree prune
```
