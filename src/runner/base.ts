import type { QueueAction, WorkflowConfig } from "../types.js";
import {
  type WorktreeInfo,
  cleanupWorktree,
  createWorktree,
  getWorktreeInfo,
} from "../worktree.js";
import type { Runner } from "./types.js";

type RunAction = Extract<QueueAction, { type: "run" }>;

export type PreparedRunContext = {
  action: RunAction;
  issueKey: string;
  prompt: string;
  maxSeconds: number;
  controller: AbortController;
  worktreeInfo: WorktreeInfo;
};

export type LiveRunContext = PreparedRunContext & {
  worktree: WorktreeInfo;
};

export abstract class BaseRunner implements Runner {
  constructor(
    protected readonly repoRoot: string,
    protected readonly log: (message: string) => void,
  ) {}

  async run(action: QueueAction, config: WorkflowConfig, dryRun: boolean): Promise<boolean> {
    if (action.type === "idle") return true;

    const preparedContext = this.prepareContext(action, config);
    this.log(`[RUN] ${this.formatRunLabel(preparedContext)}`);

    if (dryRun) {
      return this.runDry(preparedContext, config);
    }

    const gitDisabled = config.git?.disable === true;

    if (gitDisabled) {
      const liveContext: LiveRunContext = {
        ...preparedContext,
        worktree: { name: "", path: this.repoRoot, branch: "" },
      };
      const timeout = setTimeout(
        () => preparedContext.controller.abort(),
        preparedContext.maxSeconds * 1000,
      );
      try {
        return await this.runLive(liveContext, config);
      } finally {
        clearTimeout(timeout);
      }
    }

    const worktree = createWorktree(this.repoRoot, preparedContext.issueKey, config);
    const liveContext: LiveRunContext = {
      ...preparedContext,
      worktree,
    };

    const timeout = setTimeout(
      () => preparedContext.controller.abort(),
      preparedContext.maxSeconds * 1000,
    );

    try {
      return await this.runLive(liveContext, config);
    } finally {
      clearTimeout(timeout);
      cleanupWorktree(this.repoRoot, worktree);
    }
  }

  protected abstract formatRunLabel(context: PreparedRunContext): string;

  protected abstract runDry(context: PreparedRunContext, config: WorkflowConfig): Promise<boolean>;

  protected abstract runLive(context: LiveRunContext, config: WorkflowConfig): Promise<boolean>;

  private prepareContext(action: RunAction, config: WorkflowConfig): PreparedRunContext {
    const prompt = this.buildPrompt(action);
    const preparedAction: RunAction = {
      ...action,
      prompt,
    };

    return {
      action: preparedAction,
      issueKey: action.issueKey,
      prompt,
      maxSeconds: getMaxSessionSeconds(config),
      controller: new AbortController(),
      worktreeInfo: getWorktreeInfo(this.repoRoot, action.issueKey, config),
    };
  }

  private buildPrompt(action: RunAction): string {
    const prompt = action.prompt ?? "";
    const template = prompt.trim().length > 0 ? prompt : "{command} {issueKey}";
    return template
      .replace("{command}", action.command || "")
      .replace("{issueKey}", action.issueKey)
      .trim();
  }
}

function getMaxSessionSeconds(config: WorkflowConfig): number {
  return Number(process.env.MAX_SESSION_SECONDS ?? config.daemon?.maxSessionSeconds ?? 900);
}
