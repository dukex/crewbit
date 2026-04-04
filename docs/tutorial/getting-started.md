# Getting Started

This tutorial walks you through setting up crewbit to run an AI agent that picks up issues from your tracker and implements them automatically.

## Prerequisites

- [Claude Code](https://claude.ai/code) installed and authenticated
- A Jira project (or GitHub issues) with issues to work on
- Node.js ≥ 20 or [Bun](https://bun.sh)

## 1. Install crewbit

```bash
curl -fsSL https://crewbit.sh/install | bash
```

Verify the installation:

```bash
crewbit --version
```

## 2. Create a workflow file

Create a `dev-junior.yaml` file describing what your agent should do:

```yaml
provider: jira

providers:
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: JIR
    transitionIds:
      Start: "21"
      ToReview: "9"
      Done: "6"
    issueTypes:
      subtask: "10002"

transitions:
  Start:
    from: To Do
    command: /develop

daemon:
  waitSeconds: 30
  maxSessionSeconds: 7200
  worktreePrefix: dev-junior
```

## 3. Set your credentials

```bash
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=your-token
```

## 4. Start the daemon

```bash
crewbit ./dev-junior.yaml
```

crewbit will poll your Jira project, pick up the first issue in "To Do", run `claude /develop <issue-key>` in an isolated git worktree, and move the issue to "In Review" when done.

## Next steps

- See [How-to: Configure a workflow](../how-to/configure-workflow.md) for advanced configuration.
- See the [Workflow YAML reference](../reference/workflow-yaml.md) for all available options.
