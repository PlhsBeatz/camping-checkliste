/**
 * Push bei Statusänderungen selbst eingereichter Feedback-Meldungen.
 * Läuft im täglichen Cron: GitHub-Status vergleichen, ggf. benachrichtigen.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  fetchIssuesByNumbers,
  feedbackStatusLabel,
  type FeedbackStatus,
} from '@/lib/github-feedback'
import { buildFeedbackStatusPush } from '@/lib/push-notifications'
import { sendPushToUser } from '@/lib/web-push'

type SubmissionRow = {
  id: string
  user_id: string
  github_issue_number: number
  title: string
  known_status: string | null
  push_feedback_mode: string
}

function isFeedbackStatus(v: string | null | undefined): v is FeedbackStatus {
  return (
    v === 'eingegangen' ||
    v === 'todo' ||
    v === 'in_progress' ||
    v === 'in_test' ||
    v === 'erledigt'
  )
}

async function listPendingFeedbackSubmissions(db: D1Database): Promise<SubmissionRow[]> {
  try {
    const res = await db
      .prepare(
        `SELECT fs.id, fs.user_id, fs.github_issue_number, fs.title, fs.known_status,
                COALESCE(u.push_feedback_mode, 'done') AS push_feedback_mode
         FROM feedback_submissions fs
         INNER JOIN users u ON u.id = fs.user_id
         WHERE u.push_notifications_enabled = 1
           AND COALESCE(u.push_feedback, 0) = 1
           AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)
         ORDER BY fs.created_at DESC
         LIMIT 200`
      )
      .all<SubmissionRow>()
    return res.results ?? []
  } catch (err) {
    console.warn('listPendingFeedbackSubmissions:', err)
    return []
  }
}

async function updateKnownStatus(
  db: D1Database,
  id: string,
  status: FeedbackStatus
): Promise<void> {
  try {
    await db
      .prepare(`UPDATE feedback_submissions SET known_status = ? WHERE id = ?`)
      .bind(status, id)
      .run()
  } catch (err) {
    console.warn('updateKnownStatus failed:', err)
  }
}

export type FeedbackStatusPushResult = {
  checked: number
  notified: number
  baselines: number
}

export async function processFeedbackStatusPush(
  db: D1Database
): Promise<FeedbackStatusPushResult> {
  const result: FeedbackStatusPushResult = { checked: 0, notified: 0, baselines: 0 }

  if (!process.env.GITHUB_TOKEN?.trim()) {
    return result
  }

  const rows = await listPendingFeedbackSubmissions(db)
  if (rows.length === 0) return result

  result.checked = rows.length
  const numbers = rows.map((r) => r.github_issue_number)

  let statusMap: Map<number, { status: FeedbackStatus; title: string }>
  try {
    const live = await fetchIssuesByNumbers(numbers)
    statusMap = new Map(
      [...live.entries()].map(([num, item]) => [
        num,
        { status: item.status, title: item.title },
      ])
    )
  } catch (err) {
    console.warn('processFeedbackStatusPush fetch failed:', err)
    return result
  }

  for (const row of rows) {
    const live = statusMap.get(row.github_issue_number)
    if (!live) continue

    const previous = isFeedbackStatus(row.known_status) ? row.known_status : null

    // Erster Lauf: Status merken, nicht benachrichtigen (kein Spam für Altbestand)
    if (previous == null) {
      await updateKnownStatus(db, row.id, live.status)
      result.baselines++
      continue
    }

    if (previous === live.status) continue

    const mode = row.push_feedback_mode === 'all' ? 'all' : 'done'
    const completed = live.status === 'erledigt'
    const shouldNotify = mode === 'all' || completed

    if (shouldNotify) {
      const payload = buildFeedbackStatusPush({
        submissionId: row.id,
        issueNumber: row.github_issue_number,
        title: live.title || row.title,
        statusLabel: feedbackStatusLabel(live.status),
        completed,
      })
      const sent = await sendPushToUser(db, row.user_id, payload)
      if (sent.sent > 0) result.notified++
    }

    await updateKnownStatus(db, row.id, live.status)
  }

  return result
}
