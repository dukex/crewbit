---
layout: home

hero:
  name: "crewbit"
  text: "Your AI developer on autopilot."
  tagline: Watches your issues, picks the next task, runs Claude Code, and ships work.
  actions:
    - theme: brand
      text: Get Started
      link: /tutorial/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/dukex/crewbit

features:
  - title: Works like a real developer
    details: Picks tasks by priority, executes them end-to-end, and moves to the next.
  - title: Zero-config agents
    details: Define behavior, commands, and flow in a single YAML file.
  - title: Isolated execution
    details: Each run uses a separate git worktree. No conflicts. Auto-retries on failure.
---

<script setup>
import CrewbitFlow from './.vue/components/CrewbitFlow.vue'
</script>

<div style="margin: 2rem 0;">
  <CrewbitFlow />
</div>

::: warning Dangerous by design
crewbit runs Claude with `--dangerously-skip-permissions`.

It can read, write, and execute anything your shell user can.
Only run in trusted environments.
[Learn more →](/explanation/how-it-works#the-dangerously-skip-permissions-trust-model)
:::

## Install

```bash
curl -fsSL https://crewbit.sh/install | sh
crewbit ./dev-junior.yaml
```

## Workflow

```yaml
# dev-junior.yaml
provider: github-projects

providers:
  github-projects:
    owner: <github-user>
    projectNumber: <github-project-number>

transitions:
  Continue: # Get in progress issue and develop it
    from: In progress
    command: /develop
  Start: # Start issue in Ready state and develop it
    from: Ready
    command: /develop
```
