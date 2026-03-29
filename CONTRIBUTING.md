# Contributing to crewbit

Thanks for your interest in contributing.

## Development setup

```bash
pnpm install
```

Run from source:

```bash
pnpm start -- ./examples/dev-junior.yaml
pnpm dry-run -- ./examples/dev-junior.yaml
```

Build the binary:

```bash
pnpm build
./crewbit ./examples/dev-junior.yaml
```

## Code style

We use [Biome](https://biomejs.dev) for linting and formatting.

```bash
pnpm check   # lint + format in one pass
pnpm lint    # lint only
pnpm format  # format only
```

Run `pnpm check` before submitting a PR.

## Adding a provider

1. Create `src/providers/<name>.ts` implementing the `IssueProvider` interface.
2. Register it in `src/workflow.ts` inside the `createProvider` switch.
3. Add an example to `examples/<name>-persona.yaml`.

## Pull requests

- One logical change per PR.
- Keep commits atomic and use [Conventional Commits](https://www.conventionalcommits.org).
- If you're adding a feature, add an example YAML that demonstrates it.

## Reporting issues

Open an issue at https://github.com/dukex/crewbit/issues.