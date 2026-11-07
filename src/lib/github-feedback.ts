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
  /** Rohtext aus dem Issue-Body (ohne App-Metadaten-Footer), falls geladen */
  description?: string | null
}

type GitHubIssue = {
  number: number
  title: string
  state: 'open' | 'closed'
  body?: string | null
  labels: Array<{ name: string } | string>
}

/** Entfernt den App-Metadaten-Block unter dem Trenner --- */
export function extractFeedbackDescription(body: string | null | undefined): string {
  if (!body) return ''
  const trimmed = body.trim()
  const sep = trimmed.search(/\n---\n/)
  if (sep >= 0) return trimmed.slice(0, sep).trim()
  return trimmed
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
      return 'In Arbeit'
    case 'in_test':
      return 'In Test'
    case 'erledigt':
      return 'Erledigt'
    default:
      return 'Eingegangen'
  }
}

export function isFeedbackStatus(v: string | null | undefined): v is FeedbackStatus {
  return (
    v === 'eingegangen' ||
    v === 'todo' ||
    v === 'in_progress' ||
    v === 'in_test' ||
    v === 'erledigt'
  )
}

/** Parallele GitHub-GETs begrenzen (Worker-Subrequests / Rate Limits). */
const GITHUB_ISSUE_FETCH_CONCURRENCY = 8

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return
  const limit = Math.max(1, Math.min(concurrency, items.length))
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const idx = next++
        const item = items[idx]
        if (item !== undefined) await fn(item)
      }
    })
  )
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
  repo?: string,
  options?: { includeBody?: boolean; concurrency?: number }
): Promise<Map<number, FeedbackListItem>> {
  const map = new Map<number, FeedbackListItem>()
  if (numbers.length === 0) return map

  const { owner, repo: repoName } = getRepo(repo)
  const includeBody = options?.includeBody === true
  const concurrency = options?.concurrency ?? GITHUB_ISSUE_FETCH_CONCURRENCY
  const unique = [...new Set(numbers)]

  await mapWithConcurrency(unique, concurrency, async (num) => {
    const res = await githubFetch(`/repos/${owner}/${repoName}/issues/${num}`)
    if (!res.ok) return
    const issue = (await res.json()) as GitHubIssue
    map.set(num, {
      issueNumber: issue.number,
      title: issue.title,
      type: mapIssueType(issue),
      status: mapIssueStatus(issue),
      description: includeBody ? extractFeedbackDescription(issue.body) : undefined,
    })
  })
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

// --- Releases (Infos zur App) ---

export type AppReleaseInfo = {
  tag: string
  name: string
  body: string
  publishedAt: string | null
  htmlUrl: string
  prerelease: boolean
}

type GitHubReleaseApi = {
  tag_name: string
  name: string | null
  body: string | null
  published_at: string | null
  html_url: string
  draft: boolean
  prerelease: boolean
}

/** `v1.0.5` / `1.0.5` → `1.0.5` */
export function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, '')
}

export function findReleaseForAppVersion(
  releases: AppReleaseInfo[],
  version: string
): AppReleaseInfo | null {
  const target = normalizeVersionTag(version)
  if (!target) return null
  return releases.find((r) => normalizeVersionTag(r.tag) === target) ?? null
}

function mapGitHubRelease(r: GitHubReleaseApi): AppReleaseInfo {
  return {
    tag: r.tag_name,
    name: (r.name ?? '').trim() || r.tag_name,
    body: (r.body ?? '').trim(),
    publishedAt: r.published_at,
    htmlUrl: r.html_url,
    prerelease: !!r.prerelease,
  }
}

/** Kandidaten: `1.0.5` → `v1.0.5` und `1.0.5` */
export function releaseTagCandidates(versionOrTag: string): string[] {
  const raw = versionOrTag.trim()
  if (!raw) return []
  const normalized = normalizeVersionTag(raw)
  return [...new Set([raw, `v${normalized}`, normalized])]
}

export async function fetchGitHubReleaseByTag(
  versionOrTag: string,
  repo?: string
): Promise<AppReleaseInfo | null> {
  const { owner, repo: repoName } = getRepo(repo)
  for (const tag of releaseTagCandidates(versionOrTag)) {
    const res = await githubFetch(
      `/repos/${owner}/${repoName}/releases/tags/${encodeURIComponent(tag)}`
    )
    if (res.status === 404) continue
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(
        `Release ${tag} konnte nicht geladen werden (${res.status}): ${text.slice(0, 200)}`
      )
    }
    const json = (await res.json()) as GitHubReleaseApi
    if (json.draft) return null
    return mapGitHubRelease(json)
  }
  return null
}

export async function fetchGitHubReleases(options?: {
  page?: number
  perPage?: number
  repo?: string
}): Promise<{
  releases: AppReleaseInfo[]
  page: number
  perPage: number
  hasMore: boolean
}> {
  const { owner, repo: repoName } = getRepo(options?.repo)
  const page = Math.max(options?.page ?? 1, 1)
  const perPage = Math.min(Math.max(options?.perPage ?? 10, 1), 30)
  const res = await githubFetch(
    `/repos/${owner}/${repoName}/releases?per_page=${perPage}&page=${page}`
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Releases konnten nicht geladen werden (${res.status}): ${text.slice(0, 200)}`
    )
  }
  const items = (await res.json()) as GitHubReleaseApi[]
  const releases = (items ?? []).filter((r) => !r.draft).map(mapGitHubRelease)
  return {
    releases,
    page,
    perPage,
    // Volle Seite vom API → weitere Seite wahrscheinlich
    hasMore: (items?.length ?? 0) >= perPage,
  }
}

export const APP_RELEASES_PAGE_SIZE = 10
