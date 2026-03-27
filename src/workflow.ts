import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'
import type { WorkflowConfig, IssueProvider, QueueAction } from './types.js'
import { JiraProvider } from './providers/jira.js'

export function loadConfig(workflowPath?: string): WorkflowConfig {
  const configPath = workflowPath ?? resolve(dirname(fileURLToPath(import.meta.url)), '../workflow.yaml')
  const raw = readFileSync(configPath, 'utf8')
  return yaml.load(raw) as WorkflowConfig
}

export function createProvider(config: WorkflowConfig): IssueProvider {
  switch (config.provider) {
    case 'jira': {
      const jiraConfig = config.providers.jira
      if (!jiraConfig) throw new Error('workflow.yaml: providers.jira is required when provider = jira')
      return new JiraProvider(jiraConfig)
    }
    default:
      throw new Error(`workflow.yaml: unknown provider "${config.provider}". Supported: jira`)
  }
}

export async function resolveNextAction(
  config: WorkflowConfig,
  provider: IssueProvider,
): Promise<QueueAction> {
  for (const statusKey of config.queue) {
    const statusLabel = config.statuses[statusKey]
    if (!statusLabel) {
      console.warn(`[workflow] queue entry "${statusKey}" has no matching status label — skipping`)
      continue
    }

    const issues = await provider.getIssuesByStatus(statusLabel)

    if (statusKey === 'accepted' && issues.length > 0) {
      return { type: 'merge', issueKey: issues[0].key }
    }

    if (statusKey === 'in_progress') {
      for (const issue of issues) {
        const comments = await provider.getComments(issue.key)
        const isAgentStarted = comments.some(c =>
          c.body.startsWith(config.agent.planCommentMarker),
        )
        if (isAgentStarted) {
          return { type: 'develop', issueKey: issue.key }
        }
      }
    }

    if (statusKey === 'todo' && issues.length > 0) {
      return { type: 'develop', issueKey: issues[0].key }
    }
  }

  return { type: 'idle' }
}
