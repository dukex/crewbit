import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { GitHubProjectsProvider } from "./providers/github-projects.js";
import { JiraProvider } from "./providers/jira.js";
import type { IssueProvider, QueueAction, WorkflowConfig } from "./types.js";

function buildAction(
  issueKey: string,
  transition: { command: string; prompt?: string },
): QueueAction & { type: "run" } {
  const template = transition.prompt ?? "{command} {issueKey}";
  const prompt = template.replace("{command}", transition.command).replace("{issueKey}", issueKey);
  return { type: "run", issueKey, command: transition.command, prompt };
}

export function loadConfig(workflowPath: string): WorkflowConfig {
  const raw = readFileSync(resolve(workflowPath), "utf8");
  return yaml.load(raw) as WorkflowConfig;
}

export function createProvider(config: WorkflowConfig): IssueProvider {
  switch (config.provider) {
    case "jira": {
      const jiraConfig = config.providers.jira;
      if (!jiraConfig)
        throw new Error("workflow.yaml: providers.jira is required when provider = jira");
      return new JiraProvider(jiraConfig);
    }
    case "github-projects": {
      const ghConfig = config.providers["github-projects"];
      if (!ghConfig)
        throw new Error(
          "workflow.yaml: providers.github-projects is required when provider = github-projects",
        );
      return new GitHubProjectsProvider(ghConfig);
    }
    default:
      throw new Error(
        `workflow.yaml: unknown provider "${config.provider}". Supported: jira, github-projects`,
      );
  }
}

export async function resolveNextAction(
  config: WorkflowConfig,
  provider: IssueProvider,
): Promise<QueueAction> {
  for (const transition of Object.values(config.transitions)) {
    const issues = await provider.getIssuesByStatus(transition.from);
    if (issues.length > 0) {
      return buildAction(issues[0].key, transition);
    }
  }
  return { type: "idle" };
}

export async function resolveNextActions(
  config: WorkflowConfig,
  provider: IssueProvider,
  maxCount: number,
  lockedKeys: Set<string>,
): Promise<(QueueAction & { type: "run" })[]> {
  const actions: (QueueAction & { type: "run" })[] = [];
  for (const transition of Object.values(config.transitions)) {
    if (actions.length >= maxCount) break;
    const issues = await provider.getIssuesByStatus(transition.from);
    for (const issue of issues) {
      if (actions.length >= maxCount) break;
      if (lockedKeys.has(issue.key)) continue;
      actions.push(buildAction(issue.key, transition));
    }
  }
  return actions;
}
