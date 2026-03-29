# /develop — Implement a GitHub Issue

The issue key is `$ARGUMENTS` (e.g. `dukex/crewbit#42`). Always provided by the orchestrator daemon.

GitHub lifecycle: **Todo** → **In progress** → **In review** → **Done**

- Claude drives: Todo → In progress → In review.
- Human drives: In review → Done (merge) or In review → Todo (rejection with feedback).

---

## Static Reference

| Key            | Value           |
| -------------- | --------------- |
| Repo           | `dukex/crewbit` |
| Main branch    | `main`          |
| Project owner  | `dukex`         |
| Project number | `6`             |

---

## Helper — Move issue on project board

To change the **Status** field of an issue on the project board, use the GraphQL API.
Run these queries to discover the IDs, then call the mutation.

```sh
# 1. Get project node ID + Status field ID + option IDs
gh api graphql -f query='
  query {
    user(login: "dukex") {
      projectV2(number: 6) {
        id
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name }
            }
          }
        }
      }
    }
  }
'

# 2. Get the project item node ID for the issue
gh api graphql -f query='
  query($url: String!) {
    resource(url: $url) {
      ... on Issue {
        projectItems(first: 10) {
          nodes { id project { number } }
        }
      }
    }
  }
' -f url="https://github.com/dukex/crewbit/issues/NUMBER"

# 3. Update the Status field
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
' -f projectId="PROJECT_NODE_ID" \
  -f itemId="ITEM_NODE_ID" \
  -f fieldId="STATUS_FIELD_ID" \
  -f optionId="OPTION_ID_FOR_TARGET_STATUS"
```

---

## Steps

### Step 1 — Checkout or create the feature branch (MANDATORY)

**Never commit to `main`. Abort immediately if no feature branch can be found or created.**

Parse the issue key: `$ARGUMENTS` has the format `owner/repo#NUMBER` — extract NUMBER.

Check whether a branch or open PR already exists:

```sh
gh pr list --search "$ARGUMENTS" --state all --json number,url,state,headRefName
git branch -a | grep "crewbit-NUMBER"
```

- **Branch/PR found:** check out its branch and pull latest:
  ```sh
  git checkout <headRefName>
  git pull
  ```
- **Not found:** derive the branch name and create it:
  - Fetch issue title: `gh issue view NUMBER --repo dukex/crewbit --json title`
  - Slug = title lowercased, spaces replaced with `-`, non-alphanumeric chars removed, truncated to 40 chars.
  - Branch = `crewbit-NUMBER/{slug}` (e.g. `crewbit-42/github-projects-provider`).
  ```sh
  git checkout -b crewbit-NUMBER/{slug}
  git push -u origin crewbit-NUMBER/{slug}
  ```

Verify: `git branch --show-current` must NOT be `main` before proceeding.

---

### Step 2 — Fetch the issue and check for an existing plan

```sh
gh issue view NUMBER --repo dukex/crewbit --json title,body,comments
```

Internalize title, body (acceptance criteria), and all comments.

Scan all comments for one whose body starts with `# Crewbit plan`.

- **Found:** extract the plan → skip to **Step 4** (no re-planning needed).
- **Not found:** → **Step 3**.

---

### Step 3 — Move to In progress and create the plan

1. Move the issue to **In progress** on the project board:

   a. Run the metadata query (Helper query #1) — capture `projectId`, `fieldId` for "Status", and the `optionId` where `name == "In progress"`. **Save all three values; they are reused in Step 6.**

   b. Run the item query (Helper query #2) with `NUMBER` — capture `itemId` (filter `project.number == 6`).

   c. Run the mutation (Helper query #3) with the values from (a) and (b), using the **"In progress"** `optionId`.

2. Read all relevant source files for the affected area (`src/`, `daemon.ts`, `examples/`, `docs/`).
3. Break the acceptance criteria into concrete implementation steps.
4. Make every technical decision needed. Document the reasoning; do not ask the user unless genuinely blocked.
5. Post the plan as a comment:

   ```sh
   gh issue comment NUMBER --repo dukex/crewbit --body "$(cat <<'PLAN'
   # Crewbit plan

   ## Decisions
   - **Decision:** <what was decided>
     **Why:** <reasoning>

   ## Implementation steps
   1. <step>
   2. <step>
   PLAN
   )"
   ```

---

### Step 4 — Execute implementation steps one by one (TDD)

For each step in order:

1. **Write the failing test first.** No production code before a red test.
   ```sh
   mise exec -- node_modules/.bin/tsx --test src/**/*.test.ts
   ```
   Confirm the new test is red before proceeding.
2. Implement the minimum code to make the test pass.
3. Run the full test suite — all tests must be green.
4. Refactor if needed, keeping tests green.
5. Commit atomically — **verify `git branch --show-current` is NOT `main` before committing**:
   - `feat:` / `fix:` → user-facing description (these appear in the changelog).
   - `chore:` → purely technical work.
   - `git push` after every commit.

---

### Step 5 — Verify acceptance criteria and quality gate

```sh
mise exec -- node_modules/.bin/tsx --test src/**/*.test.ts   # all tests must pass
mise exec -- node_modules/.bin/biome check .                 # no lint/format errors
```

- If any check fails: fix the issue, commit the fix, and re-run the full gate.
- Do **not** proceed to Step 6 until all checks are green.

---

### Step 6 — Open PR and move to In review

1. Push the branch: `git push`.
2. Open a PR targeting `main`:

   ```sh
   gh pr create \
     --title "<issue title>" \
     --body "$(cat <<'EOF'
   ## Summary
   Closes #NUMBER

   <bullet points from acceptance criteria>

   ## Test plan
   - All unit tests passing

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

   Capture the PR URL printed by `gh pr create`.

3. Move the issue to **In review** on the project board:

   a. Reuse `projectId` and `fieldId` captured in Step 3 — find the `optionId` where `name == "In review"`.

   b. Run the item query (Helper query #2) again to get the current `itemId` for NUMBER.

   c. Run the mutation (Helper query #3) with the **"In review"** `optionId`. Verify the mutation returns without errors before proceeding.
4. Post a closing comment:

   ```sh
   gh issue comment NUMBER --repo dukex/crewbit --body "# Claude plan — completed

   All steps done. AC verified. PR opened.
   PR: <PR URL>
   Commits: <list of commit hashes and one-line messages>"
   ```

5. Output `DEVELOP_ITERATION_DONE` and stop immediately. **No other text.**

---

## Rules

- TDD cycle: Red → Green → Refactor. No exceptions.
- Never write production code before a failing test.
- One atomic commit per implementation step.
- **Never commit to `main`.** Always on a feature branch. Verify with `git branch --show-current` before every commit.
- If a decision genuinely requires human input, output `DEVELOP_NEEDS_INPUT: <question>` and stop.
- **At the end: output only `DEVELOP_ITERATION_DONE`. Nothing else.**
