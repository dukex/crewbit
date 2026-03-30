import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";
import { GitHubProjectsProvider } from "./providers/github-projects.js";
import { JiraProvider } from "./providers/jira.js";
import type { IssueProvider, QueueAction, WorkflowConfig } from "./types.js";

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
      const issueKey = issues[0].key;
      const template = transition.prompt ?? "{command} {issueKey}";
      const prompt = template
        .replace("{command}", transition.command)
        .replace("{issueKey}", issueKey);
      return { type: "run", issueKey, command: transition.command, prompt };
    }
  }
  return { type: "idle" };
}
