# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # install dependencies
pnpm start -- ./examples/dev-junior.yaml   # run daemon from source
pnpm dry-run -- ./examples/dev-junior.yaml # dry-run (no Claude spawned)
pnpm build            # compile binary via Bun: outputs ./crewbit
pnpm check            # lint + format (run before PRs)
pnpm lint             # lint only
pnpm format           # format only
```

> Tests run with `pnpm test`. Use `--dry-run` to validate config changes without spawning Claude.

## Architecture

crewbit is a single-process daemon written in TypeScript (ESM, Node ≥ 20). Entry point is `src/cli.ts`; library code lives under `src/`.

### Core flow

```
src/cli.ts → runDaemonCommand() → loadConfig() → createProvider() → resolveNextAction() → runClaude()
```

1. **`loadConfig`** (`src/workflow.ts`) — reads the YAML workflow file and returns a typed `WorkflowConfig`.
2. **`createProvider`** (`src/workflow.ts`) — factory that returns an `IssueProvider` based on `config.provider`. Only `jira` is supported today.
3. **`resolveNextAction`** (`src/workflow.ts`) — iterates `config.transitions` in declaration order, calls `provider.getIssuesByStatus()` for each `from` status, and returns the first matching issue as a `run` action (or `idle`).
4. **`runClaude`** (`src/commands/daemon.ts`) — creates an isolated git worktree under `.claude/worktrees/<prefix>-<issueKey>`, spawns `claude --dangerously-skip-permissions --no-session-persistence --print <command> <issueKey>` inside it, then cleans up the worktree on exit.

### Key design points

- **Transition order = priority.** Whichever transition is listed first in the YAML wins when multiple queues have work.
- **Worktree isolation.** Each Claude session runs in its own `git worktree` so it gets a clean checkout. The temp branch (`worktree-<prefix>-<issueKey>`) is deleted on cleanup; the feature branch Claude creates is preserved.
- **Exponential backoff.** Empty queue doubles the wait (capped at 10×). Failed sessions back off separately (capped at 32×).
- **Blocked env vars.** `CLAUDE_CODE_SSE_PORT`, `NODE_OPTIONS`, `VSCODE_*`, and any `CLAUDE_CODE_*` vars are stripped before spawning the child Claude process to prevent conflicts.

### Adding a provider

1. Create `src/providers/<name>.ts` implementing the `IssueProvider` interface (`src/types.ts`).
2. Register the new case in `createProvider` in `src/workflow.ts`.
3. Add an example YAML under `examples/`.

## Code style

Biome (v1.9) enforces all style rules. Key settings: 2-space indent, 100-char line width, double quotes, trailing commas, semicolons always.

## Development workflow

We work as XP (eXtreme Programming) pair programmers. These rules are **mandatory** and override all other defaults:

1. **[IMPORTANT] XP pair programming** — Claude is the pair, the user drives. All decisions are made together.
2. **[IMPORTANT] Tests first** — Before any implementation, write tests that reflect what the User Story expects. Tests must be red/failing before writing production code.
3. **Edge cases** — Always consider edge cases when writing test scenarios.
4. **INVEST User Stories** — All US must be Independent, Negotiable, Valuable, Estimable, Small, Testable. If a US is not INVEST, break it into smaller parts until it is.
5. **Baby steps** — Only write production code after tests are broken/red. Implement the minimum to make tests pass.
6. **TDD cycle** — Red → Green → Refactor. No exceptions.
7. **[IMPORTANT] E2E / regression tests** — After implementing a full feature or user flow, write an E2E test that exercises the integrated path. Unit tests catch isolated logic errors; E2E tests catch integration bugs that are invisible to unit tests.
8. **Atomic conventional commits** — Commit often, one logical change per commit. Use conventional commit format. `feat:` and `fix:` messages target the final user (they generate the changelog) — write them as user-facing descriptions, promoting the new feature, not technical notes.
   - **[IMPORTANT] `feat:` and `fix:` are ONLY for changes the end user directly experiences** — new capabilities, changed behaviours, or fixed bugs in the product itself. Internal work (docs, CI, test infra, site design, refactors, dependency bumps, tooling) must use `docs:`, `ci:`, `test:`, `style:`, `refactor:`, or `chore:` accordingly.
   - Examples of things that are **NOT** `feat:` or `fix:`: updating site colours, adding a VitePress docs portal, fixing a GitHub Actions workflow, adding `.nojekyll`, bumping pnpm version, adding/updating tests.
9. **[IMPORTANT] Always commit and push** — After every change, commit with a conventional commit message and push to remote immediately.
10. **[IMPORTANT] Always update docs** — For every feature, fix, or behaviour change, check `docs/` and update or create the relevant pages (reference, how-to, or both) before committing. Use the `documenter` agent to do this.

## Basic Rules

- Avoid add not necessary comments in code, comment with not clear propose is a bad practice
- Always use meaningful variable names, avoid using single letter variables
- Use consistent naming conventions for functions and variables
- Always add a task for yourself to check if the code is working

## Memory

@.claude/memory/MEMORY.md is the **index** — it lists all memory files with one-line descriptions. Each topic lives in its own file inside `.claude/memory/`.

**At session start:** read `MEMORY.md` to see what exists, then read the files relevant to the current task.

**When saving new knowledge:**

1. Find the matching theme file (or create a new one with a descriptive name).
2. Add the content to that file.
3. If it's a new file, add a pointer to `MEMORY.md`.
