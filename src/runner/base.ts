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
  command: string;
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
    const command = this.buildCommand(action, prompt);
    const preparedAction: RunAction = {
      ...action,
      command,
      prompt,
    };

    return {
      action: preparedAction,
      issueKey: action.issueKey,
      command,
      prompt,
      maxSeconds: getMaxSessionSeconds(config),
      controller: new AbortController(),
      worktreeInfo: getWorktreeInfo(this.repoRoot, action.issueKey, config),
    };
  }

  private buildPrompt(action: RunAction): string {
    const template = action.prompt.trim().length > 0 ? action.prompt : "{command} {issueKey}";
    return template
      .replace("{command}", action.command)
      .replace("{issueKey}", action.issueKey)
      .trim();
  }

  private buildCommand(action: RunAction, prompt: string): string {
    const command = action.command.trim();
    if (command.length > 0) {
      return command;
    }

    const firstToken = prompt
      .trim()
      .split(/\s+/)
      .find((token) => token.length > 0);
    return firstToken ?? "";
  }
}

function getMaxSessionSeconds(config: WorkflowConfig): number {
  return Number(process.env.MAX_SESSION_SECONDS ?? config.daemon?.maxSessionSeconds ?? 900);
}
