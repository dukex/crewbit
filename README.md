# crewbit

Give life to an AI agent with a single command.

```bash
crewbit ./dev-junior.yaml
```

crewbit is a daemon that watches an issue tracker, picks up work in priority order, and runs a [Claude Code](https://claude.ai/code) slash command for each issue. The entire behavior of an agent — what it does, in what order, with which commands — is defined in one YAML file.

## How it works

1. You define a workflow YAML with transitions and commands.
2. crewbit polls the issue tracker in a loop.
3. When an issue is ready, it spawns `claude --print <command> <issue-key>` in an isolated git worktree.
4. On success, it moves to the next issue. On failure, it backs off and retries.

## Install

**Binary (recommended):**

```bash
curl -fsSL https://crewbit.sh/install | sh
```

Installs the latest release to `/usr/local/bin/crewbit`. Override the directory:

```bash
CREWBIT_INSTALL_DIR=~/.local/bin curl -fsSL https://crewbit.sh/install | sh
```

**From source (requires [Bun](https://bun.sh)):**

```bash
git clone https://github.com/dukex/crewbit
cd crewbit
bun run build
sudo mv crewbit /usr/local/bin/
```

## Usage

```bash
crewbit <path-to-workflow.yaml> [--dry-run]
```

| Flag | Description |
|------|-------------|
| `--dry-run` | Print what would run without spawning Claude |

Environment variables override daemon config:

| Variable | Default | Description |
|----------|---------|-------------|
| `WAIT_SECONDS` | from yaml | Polling interval when queue is empty |
| `MAX_SESSION_SECONDS` | from yaml | Hard timeout per Claude session |

## Workflow YAML

```yaml
provider: jira

providers:
  jira:
    baseUrl: https://your-org.atlassian.net
    projectKey: KAN
    transitionIds:
      Start: "21"     # To Do → In Progress
      ToReview: "9"   # In Progress → In Review
      Done: "6"       # Accepted → Done
    issueTypes:
      subtask: "10002"

# Daemon iterates in order — first transition with pending issues wins
transitions:
  Done:
    from: Accepted
    command: /merge
  Start:
    from: To Do
    command: /develop

agent:
  planCommentMarker: "Claude plan"

daemon:
  waitSeconds: 30
  maxSessionSeconds: 7200
  worktreePrefix: dev-junior

# optional
git:
  defaultBranch: main
  branchPattern: "{issueKey}/{slug}"
  slugMaxLength: 40
```

**`transitions`** defines the work the daemon picks up. The order sets the priority — the first transition with pending issues wins each cycle. Each transition maps to a Claude Code slash command.

See [`examples/`](./examples) for ready-to-use personas.

## Examples

| File | What it does |
|------|-------------|
| [`examples/dev-junior.yaml`](./examples/dev-junior.yaml) | Implements tickets and merges accepted PRs |
| [`examples/releaser.yaml`](./examples/releaser.yaml) | Runs the release process |
| [`examples/copywriter.yaml`](./examples/copywriter.yaml) | Drafts and publishes marketing copy |
| [`examples/qa-bot.yaml`](./examples/qa-bot.yaml) | Runs test suites and reports results |
| [`examples/translator.yaml`](./examples/translator.yaml) | Translates i18n tickets |

## Environment variables (Jira provider)

```bash
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=your-token
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)