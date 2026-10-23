/**
 * GitHub Issues Proxy für In-App-Feedback.
 * Token nur serverseitig (GITHUB_TOKEN).
 *
 * Status-Labels werden vom Project-Board gespiegelt (siehe docs/github-workflow.md).
 */

import { APP_VERSION, formatAppVersionDisplay } from '@/lib/app-version'

export const DEFAULT_GITHUB_REPO = 'PlhsBeatz/camping-checkliste'

export const FEEDBACK_LABELS = {
  feedback: 'feedback',
  bug: 'bug',
  enhancement: 'enhancement',
  roadmap: 'roadmap',
  statusTodo: 'status:todo',
  statusInProgress: 'status:in-progress',
  statusInTest: 'status:in-test',
  /** Legacy – bis Backfill/Cleanup */
  statusGeplant: 'status:geplant',
  statusInArbeit: 'status:in-arbeit',
  statusErledigt: 'status:erledigt',
} as const

export type FeedbackType = 'bug' | 'enhancement'

/** UI-/API-Status (Project: Backlog/Todo/In Progress/In Test/Done). */
export type FeedbackStatus =
  | 'eingegangen'
  | 'todo'
  | 'in_progress'
  | 'in_test'
  | 'erledigt'

export type FeedbackListItem = {
  issueNumber: number
  title: string
  type: FeedbackType | null
  status: FeedbackStatus
}

type GitHubIssue = {
  number: number
  title: string
  state: 'open' | 'closed'
  labels: Array<{ name: string } | string>
}

function labelNames(issue: GitHubIssue): string[] {
  return issue.labels.map((l) => (typeof l === 'string' ? l : l.name))
}

export function mapIssueStatus(issue: Pick<GitHubIssue, 'state' | 'labels'>): FeedbackStatus {
  if (issue.state === 'closed') return 'erledigt'
  const names = labelNames(issue as GitHubIssue)
  if (
    names.includes(FEEDBACK_LABELS.statusErledigt) ||
    names.includes('status:done')
  ) {
    return 'erledigt'
  }
  if (names.includes(FEEDBACK_LABELS.statusInTest)) return 'in_test'
  if (
    names.includes(FEEDBACK_LABELS.statusInProgress) ||
    names.includes(FEEDBACK_LABELS.statusInArbeit)
  ) {
    return 'in_progress'
  }
  if (
    names.includes(FEEDBACK_LABELS.statusTodo) ||
    names.includes(FEEDBACK_LABELS.statusGeplant)
  ) {
    return 'todo'
  }
  if (names.includes(FEEDBACK_LABELS.roadmap)) return 'todo'
  return 'eingegangen'
}

export function mapIssueType(issue: Pick<GitHubIssue, 'labels'>): FeedbackType | null {
  const names = labelNames(issue as GitHubIssue)
  if (names.includes(FEEDBACK_LABELS.bug)) return 'bug'
  if (names.includes(FEEDBACK_LABELS.enhancement)) return 'enhancement'
  return null
}

export function feedbackStatusLabel(status: FeedbackStatus): string {
  switch (status) {
    case 'todo':
      return 'Todo'
    case 'in_progress':
      return 'In Progress'
    case 'in_test':
      return 'In Test'
    case 'erledigt':
      return 'Erledigt'
    default:
      return 'Eingegangen'
  }
}

function getRepo(repo?: string): { owner: string; repo: string } {
  const raw = (repo ?? process.env.GITHUB_REPO ?? DEFAULT_GITHUB_REPO).trim()
  const [owner, name] = raw.split('/')
  if (!owner || !name) {
    throw new Error(`Ungültiges GITHUB_REPO: ${raw}`)
  }
  return { owner, repo: name }
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) {
    throw new Error('GITHUB_TOKEN ist nicht konfiguriert')
  }
  return token
}

async function githubFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = getToken()
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      // GitHub REST API verlangt User-Agent (403 sonst)
      'User-Agent': 'CampCheck-PWA',
      ...(init?.headers ?? {}),
    },
  })
}

export function buildFeedbackIssueBody(input: {
  description: string
  type: FeedbackType
  userEmail: string
  userId: string
  userAgent?: string | null
  appVersion?: string
}): string {
  const version = input.appVersion ?? formatAppVersionDisplay(APP_VERSION)
  return [
    input.description.trim(),
    '',
    '---',
    `_Aus der App gemeldet_`,
    '',
    `- **Typ:** ${input.type === 'bug' ? 'Fehler' : 'Verbesserung'}`,
    `- **User:** ${input.userEmail} (\`${input.userId}\`)`,
    `- **App-Version:** ${version}`,
    input.userAgent ? `- **User-Agent:** ${input.userAgent}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function createFeedbackIssue(input: {
  title: string
  body: string
  type: FeedbackType
  repo?: string
}): Promise<{ number: number; htmlUrl: string }> {
  const { owner, repo } = getRepo(input.repo)
  const labels = [FEEDBACK_LABELS.feedback, input.type]

  const res = await githubFetch(`/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title: input.title.trim(),
      body: input.body,
      labels,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub Issue konnte nicht erstellt werden (${res.status}): ${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as { number: number; html_url: string }
  return { number: json.number, htmlUrl: json.html_url }
}

export async function fetchIssuesByNumbers(
  numbers: number[],
  repo?: string
): Promise<Map<number, FeedbackListItem>> {
  const map = new Map<number, FeedbackListItem>()
  if (numbers.length === 0) return map

  const { owner, repo: repoName } = getRepo(repo)
  // Parallel, aber begrenzt – typisch wenige eigene Issues
  const unique = [...new Set(numbers)]
  await Promise.all(
    unique.map(async (num) => {
      const res = await githubFetch(`/repos/${owner}/${repoName}/issues/${num}`)
      if (!res.ok) return
      const issue = (await res.json()) as GitHubIssue
      map.set(num, {
        issueNumber: issue.number,
        title: issue.title,
        type: mapIssueType(issue),
        status: mapIssueStatus(issue),
      })
    })
  )
  return map
}

export async function fetchRoadmapIssues(repo?: string): Promise<FeedbackListItem[]> {
  const { owner, repo: repoName } = getRepo(repo)
  const q = encodeURIComponent(
    `repo:${owner}/${repoName} is:issue label:${FEEDBACK_LABELS.roadmap}`
  )
  const res = await githubFetch(`/search/issues?q=${q}&sort=updated&order=desc&per_page=30`)
  if (!res.ok) {
    // Fallback: list issues with label filter
    const listRes = await githubFetch(
      `/repos/${owner}/${repoName}/issues?labels=${encodeURIComponent(FEEDBACK_LABELS.roadmap)}&state=all&per_page=30`
    )
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => '')
      throw new Error(`Roadmap konnte nicht geladen werden (${listRes.status}): ${text.slice(0, 200)}`)
    }
    const issues = (await listRes.json()) as GitHubIssue[]
    return issues
      .filter((i) => !('pull_request' in i && (i as { pull_request?: unknown }).pull_request))
      .map((issue) => ({
        issueNumber: issue.number,
        title: issue.title,
        type: mapIssueType(issue),
        status: mapIssueStatus(issue),
      }))
  }

  const json = (await res.json()) as { items: GitHubIssue[] }
  return (json.items ?? []).map((issue) => ({
    issueNumber: issue.number,
    title: issue.title,
    type: mapIssueType(issue),
    status: mapIssueStatus(issue),
  }))
}
