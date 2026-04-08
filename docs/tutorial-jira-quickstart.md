# Tutorial: Your first dev agent in 5 minutes (Jira)

This tutorial takes you from zero configuration to a running crewbit daemon that picks up a real Jira ticket and spawns a Claude session. By the end, you will have a visible, working agent.

---

## Prerequisites

Before you start, make sure you have:

- **Claude Code** installed and authenticated (`claude --version` prints a version number).
- **jq** installed (`jq --version` prints a version number) — used in Step 3 to parse Jira API output.
- **A Jira project** with at least one issue in the "To Do" status assigned to your Jira account.
- **Jira credentials** — your Atlassian account email and an [API token](https://id.atlassian.com/manage-profile/security/api-tokens).
- **A Git repository** for the project your agent will work on (crewbit runs Claude inside a git worktree).

---

## Step 1 — Install crewbit

Install the latest binary to `/usr/local/bin`:

```bash
curl -fsSL https://crewbit.sh/install | bash
```

You will verify the install works in Step 5 with a dry run.

---

## Step 2 — Export your Jira credentials

crewbit reads your Jira credentials from environment variables. Add these to your shell profile (`.zshrc`, `.bashrc`, etc.) or export them for the current session:

```bash
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=your-api-token-here
```

Verify they are set:

```bash
echo $JIRA_EMAIL
```

You should see your email address printed.

---

## Step 3 — Find your Jira transition IDs

The YAML config includes a `transitionIds` map that your Claude slash commands (e.g. `/develop`, `/merge`) use to move issues through your Jira workflow. Run this command to discover the numeric IDs, replacing the placeholders with your values:

```bash
curl -s \
  -u "$JIRA_EMAIL:$JIRA_API_TOKEN" \
  "https://your-org.atlassian.net/rest/api/3/issue/YOUR-ISSUE-KEY/transitions" \
  | jq '.transitions[] | {id, name}'
```

You will see output like:

```json
{ "id": "21", "name": "Start Progress" }
{ "id": "9",  "name": "Send to Review" }
{ "id": "6",  "name": "Done" }
```

Note the IDs for the transitions you want crewbit to drive. You will use them in the next step.

---

## Step 4 — Create your workflow YAML

In the root of your Git repository, create a file called `crewbit.yaml`:

```yaml
provider: jira

providers:
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: JIR
    transitionIds:
      Start: "21" # To Do → In Progress
      ToReview: "9" # In Progress → In Review
      Done: "6" # Accepted → Done
    issueTypes:
      subtask: "10002"

transitions:
  Done:
    from: Accepted
    command: /merge
  Start:
    from: To Do
    command: /develop

agent:
  planCommentMarker: "Crewbit plan"

daemon:
  waitSeconds: 30
  maxSessionSeconds: 7200

git:
  worktreePrefix: my-agent
```

Replace `your-org`, `JIR`, and the transition IDs with your actual values.

---

## Step 5 — Validate with a dry run

Before spawning any real Claude sessions, use `--dry-run` to confirm crewbit can connect to Jira and read your queue:

```bash
crewbit ./crewbit.yaml --dry-run
```

A successful dry run prints which issue would be picked up and which command would run, for example:

```
Starting crewbit daemon (repo root: /path/to/repo)...
[2025-01-01 12:34:56] crewbit starting (dry-run)
[2025-01-01 12:34:56] Config: /path/to/crewbit.yaml
[2025-01-01 12:34:56] [RUN] /develop JIR-42
[2025-01-01 12:34:56] [dry-run] would run: claude --print '/develop JIR-42'
```

If you see this, your config is valid. If you see an error, check your `baseUrl`, `projectKey`, and environment variables.

---

## Step 6 — Run the daemon

Once the dry run succeeds, start the live daemon:

```bash
crewbit ./crewbit.yaml
```

crewbit will:

1. Poll Jira by checking each transition's `from` status in declaration order (in the example YAML, `Accepted` is checked before `To Do`).
2. Pick up the first matching issue that is assigned to your Jira account.
3. Create an isolated git worktree for the session.
4. Spawn `claude --print /develop JIR-42` inside that worktree.

Watch the terminal — you will see log lines showing each poll, the issue key picked up, and the Claude session start. Jira status transitions are performed by the Claude slash commands themselves, not by the daemon.

---

## What just happened?

- crewbit read your YAML and connected to Jira using your credentials.
- It found an issue assigned to you that matched one of the configured `from` statuses.
- It ran your `/develop` slash command inside a clean git worktree, so Claude had a safe, isolated environment.
- When the session finished, the worktree was cleaned up automatically.

---

## Next steps

- **How-to guides** — See [CONTRIBUTING.md](https://github.com/dukex/crewbit/blob/main/CONTRIBUTING.md) for adding providers, adjusting polling, and running from source.
- **YAML reference** — The full schema is documented in the [README](https://github.com/dukex/crewbit/blob/main/README.md#workflow-yaml).
- **More example personas** — See the [`examples/`](https://github.com/dukex/crewbit/tree/main/examples) directory for ready-to-use configurations (releaser, copywriter, QA bot, translator).
