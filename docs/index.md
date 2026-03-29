---
layout: home

hero:
  name: "crewbit"
  text: "Give life to your Claude Code with a single command."
  tagline: A daemon that watches your issue tracker, picks up work in priority order, and runs Claude Code for each issue, like new dev.
  actions:
    - theme: brand
      text: Get Started
      link: /tutorial/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/dukex/crewbit

features:
  - title: Zero-config agents
    details: Define your agent's entire behavior — what it does, in what order, with which commands — in a single YAML file.
  - title: Issue tracker driven
    details: crewbit polls your issue tracker and picks up work automatically. Supports Jira and GitHub Projects.
  - title: Isolated execution
    details: Each Claude session runs in its own git worktree so branches never conflict. Failed sessions back off automatically.
---

::: warning Dangerous by design
crewbit spawns Claude Code with `--dangerously-skip-permissions`, which disables all permission prompts. Claude can read, write, and execute anything your shell user can. Only run crewbit in environments you trust and with slash commands you have reviewed. See [how dangerously-skip-permissions works](/explanation/how-it-works#the-dangerously-skip-permissions-trust-model).
:::

## Install

```bash
curl -fsSL https://crewbit.sh/install | sh
```

Then point it at a workflow file:

```bash
crewbit ./dev-junior.yaml
```
