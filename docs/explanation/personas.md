# What is a crewbit persona and how to design one

## What a persona is

A persona is a workflow YAML file that describes a single-purpose agent: which issue states it watches, which Claude command it runs when it finds work, and how long that session is allowed to run. Each crewbit daemon process you start corresponds to exactly one persona. The file is the complete specification of that agent's job — if you can describe the job in one sentence, you can express it as a persona.

## Why single-purpose personas are preferable

It is tempting to build one all-purpose persona that handles every stage of your workflow. In practice this causes problems that are hard to debug and harder to fix.

A single-purpose persona has one job, which means it has one failure mode. When it fails you know exactly what was being attempted. Two personas that fail independently give you two isolated crash reports rather than one tangled one. You can also kill and restart a specific persona without disturbing others — a persona that handles code review can be restarted after a bug fix without interrupting the persona that handles implementation.

Priority is another reason to keep personas separate. Transition order within a single YAML file determines which queue is served first, but that ordering is fixed for the lifetime of that daemon. If you want the merge-PR persona to always take precedence over the implement-issue persona, you make them two separate processes. Each one looks only at its own queue and cannot accidentally deprioritise the other.

Finally, single-purpose personas are easier to tune. A translation task and an implementation task have very different runtime profiles, complexity levels, and tool requirements. Mixing them into one persona means accepting a single timeout and a single command for work that is not comparable.

## Connecting timeout to command complexity

The `daemon.maxSessionSeconds` field is a hard wall-clock limit. When Claude has been running for that many seconds, crewbit kills the session regardless of progress. Setting this value well requires thinking about the realistic upper bound for the command the persona runs.

A command that translates UI strings into a target language might finish in five minutes on a well-scoped issue. A command that implements a feature from a specification might need two hours. Setting `maxSessionSeconds` to 300 for the latter means Claude will be killed mid-implementation, every time. Setting it to 7200 for the former means a runaway session holds a worktree for two hours unnecessarily.

Set the timeout to the realistic ceiling for the expected task, with a small margin. Review it when you notice sessions consistently finishing far under the limit, or consistently being cut off.

## Designing for idempotency

crewbit may run the same command against the same issue more than once. A daemon restart, a transient API failure, or a session killed by the timeout can all cause the issue to reappear in the watched status. The Claude command must produce the same outcome whether it is the first attempt or the fifth.

Concretely, this means the command should check for existing work before starting. If the persona's job is to open a pull request, the command should first ask whether a pull request already exists for this issue. If one does, the correct response is to update or close that PR, not to open a second one. If the persona's job is to implement a feature, the command should check whether a branch already exists and, if so, continue from the furthest point of progress rather than recreating work.

A reliable check sequence looks like: does a branch exist for this issue? Does a PR exist? Is there a plan comment on the issue? Starting from the answers to those questions costs very little and prevents a large class of duplicate-work bugs.

## Designing for recoverable failure

Sessions fail. The network drops, an API returns an unexpected response, Claude produces code that does not compile, or the timeout is hit. A well-designed persona ensures that the next attempt can continue rather than start over.

The most useful thing Claude can do before a session ends — whether gracefully or not — is commit whatever progress exists. A partial branch with a meaningful commit message is far more useful than nothing. A future session can read the commit history to understand what was completed and where to continue. An empty worktree tells the next session nothing.

The `agent.planCommentMarker` field is designed for exactly this purpose. When Claude posts a comment to the issue that begins with the configured marker string, the daemon treats that comment as a structured plan. On the next attempt, the command can retrieve the issue's comments and find the plan comment by its marker, then use its contents to resume. This makes the plan durable across process restarts, crashes, and timeouts — it lives in the issue tracker, not in the daemon's memory.

Good plan comments include the current step, the steps already completed, and any decisions made (e.g. which API endpoint to call, which branch was created). The goal is that a fresh session reading only the issue and its comments can get to work without repeating completed steps.

For configuration instructions on writing Claude commands that implement these patterns, see [../how-to/write-slash-commands](../how-to/write-slash-commands.md). For the full field specification of `daemon`, `agent`, and `transitions`, see the [Workflow YAML reference](../reference/workflow-yaml.md).
