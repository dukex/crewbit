import type { IssueProvider, Issue, Comment, JiraProviderConfig } from '../types.js'

interface AdfNode {
  type: string
  text?: string
  content?: AdfNode[]
}

function extractTextFromAdf(node: AdfNode): string {
  if (node.type === 'text' && node.text) return node.text
  if (!node.content) return ''
  return node.content.map(extractTextFromAdf).join('')
}

export class JiraProvider implements IssueProvider {
  private readonly baseUrl: string
  private readonly projectKey: string
  private readonly authHeader: string

  constructor(config: JiraProviderConfig) {
    const email = process.env.JIRA_EMAIL
    const token = process.env.JIRA_API_TOKEN

    if (!email || !token) {
      throw new Error('JIRA_EMAIL and JIRA_API_TOKEN environment variables are required')
    }

    this.baseUrl = config.baseUrl
    this.projectKey = config.projectKey
    this.authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
  }

  async getIssuesByStatus(statusLabel: string): Promise<Issue[]> {
    const jql = `project = ${this.projectKey} AND status = "${statusLabel}" AND issuetype != Subtask ORDER BY updated DESC`
    const url = `${this.baseUrl}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status`

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Jira search failed: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as { issues: Array<{ key: string; fields: { summary: string; status: { name: string } } }> }

    return (data.issues ?? []).map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
    }))
  }

  async getComments(issueKey: string): Promise<Comment[]> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/comment?maxResults=50`

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Jira getComments failed for ${issueKey}: ${response.status} ${await response.text()}`)
    }

    const data = (await response.json()) as { comments: Array<{ body: AdfNode | string }> }

    return (data.comments ?? []).map(comment => {
      const body =
        typeof comment.body === 'string'
          ? comment.body
          : extractTextFromAdf(comment.body as AdfNode)
      return { body: body.trim() }
    })
  }
}
