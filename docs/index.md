---
layout: home

hero:
  name: "crewbit"
  text: "Give life to an AI agent with a single command."
  tagline: A daemon that watches your issue tracker, picks up work in priority order, and runs Claude Code for each issue.
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
    details: crewbit polls your issue tracker and picks up work automatically. Supports Jira today, more providers coming.
  - title: Isolated execution
    details: Each Claude session runs in its own git worktree so branches never conflict. Failed sessions back off automatically.
---

## Install

```bash
curl -fsSL https://crewbit.sh/install | sh
```

Then point it at a workflow file:

```bash
crewbit ./dev-junior.yaml
```
