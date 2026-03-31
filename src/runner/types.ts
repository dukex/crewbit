import type { QueueAction, WorkflowConfig } from "../types.js";

export type Runner = {
  run: (action: QueueAction, config: WorkflowConfig, dryRun: boolean) => Promise<boolean>;
};

export type RunnerName = "claude" | "opencode";
