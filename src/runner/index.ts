import type { WorkflowConfig } from "../types.js";
import { ClaudeCodeRunner } from "./claude-code.js";
import { OpenCodeRunner } from "./opencode.js";
import type { Runner, RunnerName } from "./types.js";

export type { Runner, RunnerName } from "./types.js";
export { ClaudeCodeRunner } from "./claude-code.js";
export { OpenCodeRunner } from "./opencode.js";

export function createRunner(
  config: WorkflowConfig,
  repoRoot: string,
  log: (message: string) => void,
): Runner {
  const runnerName: RunnerName = config.runner ?? "claude";
  return runnerName === "opencode"
    ? new OpenCodeRunner(repoRoot, log)
    : new ClaudeCodeRunner(repoRoot, log);
}
