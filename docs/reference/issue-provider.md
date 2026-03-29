# IssueProvider interface

Reference for contributors who want to add a new issue-tracker backend to crewbit.

## Overview

Every provider must implement the `IssueProvider` interface defined in `src/types.ts`. The daemon calls these two methods on every polling cycle.

```typescript
export interface Issue {
  key: string;
  summary: string;
  status: string;
}

export interface Comment {
  body: string;
}

export interface IssueProvider {
  getIssuesByStatus(statusLabel: string): Promise<Issue[]>;
  getComments(issueKey: string): Promise<Comment[]>;
}
```

## Methods

### `getIssuesByStatus(statusLabel: string): Promise<Issue[]>`

Returns all issues whose current status matches `statusLabel` and that are assigned to the authenticated user.

**Parameter**

`statusLabel` is an arbitrary string whose meaning is defined by the provider. For Jira it is the column name as shown in the board (e.g. `"In Progress"`). For GitHub Projects it is the field value configured in the project (e.g. `"Ready"`). The string is passed through directly from the `from` field of a transition in the workflow YAML.

**Return value**

A `Promise` that resolves to an array of `Issue` objects. The array must be ordered most-recently-updated first, so that the daemon always picks the most active work item. When no issues match the status and assignee filter the method must resolve with an empty array — it must never throw in this case.

**Assignee filter**

The method must only return issues assigned to the authenticated user. The credentials used to authenticate are specific to each provider implementation. This constraint ensures that a single crewbit instance does not accidentally claim work belonging to a different team member.

**`Issue` field conventions**

| Field | Type | Description |
| --- | --- | --- |
| `key` | string | Unique identifier for the issue. Jira format: `PROJ-123`. GitHub Projects format: `owner/repo#number`. |
| `summary` | string | Human-readable title of the issue. |
| `status` | string | Current status label as returned by the provider API. |

**Error handling**

Do not throw from this method. If the provider API returns an error, log it and resolve with `[]` so the daemon can continue polling. Reserve throwing for `getComments`, where a bad issue key is a programmer error rather than a transient state.

### `getComments(issueKey: string): Promise<Comment[]>`

Returns all comments on the issue identified by `issueKey`, in chronological order (oldest first).

**Parameter**

`issueKey` is a provider-specific identifier in the format described above (e.g. `PROJ-123` for Jira, `owner/repo#number` for GitHub Projects).

**Return value**

A `Promise` that resolves to an array of `Comment` objects ordered from the earliest to the most recent. Returns an empty array if the issue exists but has no comments.

**`Comment` field conventions**

| Field | Type | Description |
| --- | --- | --- |
| `body` | string | Full text of the comment, in whatever markup the provider uses. |

**Error handling**

Throw an `Error` when:

- The `issueKey` format is invalid for the provider.
- The provider API returns a non-recoverable error (e.g. 4xx, 5xx).

Do not silently swallow errors here. The daemon uses comments to read plan markers written by a previous Claude session, so missing data must surface loudly.

## Registering a new provider

Place the implementation at `src/providers/<name>.ts`. Then add a case to the `createProvider` switch in `src/workflow.ts`:

```typescript
case "my-provider":
  return new MyProvider(config.providers["my-provider"] as MyProviderConfig);
```

Add the corresponding config type to `src/types.ts` and add an example workflow file to `examples/` so users can see the required YAML structure.

## Existing implementations

The two built-in providers are good starting points:

- `src/providers/jira.ts` — uses the Jira REST API v3 with basic auth.
- `src/providers/github-projects.ts` — uses the GitHub GraphQL API with a personal access token.
