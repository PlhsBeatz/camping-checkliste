/**
 * Sync known_status aus GitHub + optional Push bei Änderungen.
 * Cron: nur offene/unbekannte Meldungen pollen (erledigte überspringen).
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  fetchIssuesByNumbers,
  feedbackStatusLabel,
  isFeedbackStatus,
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
  can_notify: number
}

async function listOpenFeedbackSubmissions(db: D1Database): Promise<SubmissionRow[]> {
  try {
    const res = await db
      .prepare(
        `SELECT fs.id, fs.user_id, fs.github_issue_number, fs.title, fs.known_status,
                COALESCE(u.push_feedback_mode, 'done') AS push_feedback_mode,
                CASE
                  WHEN u.push_notifications_enabled = 1
                   AND COALESCE(u.push_feedback, 0) = 1
                   AND EXISTS (
                     SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id
                   )
                  THEN 1 ELSE 0
                END AS can_notify
         FROM feedback_submissions fs
         INNER JOIN users u ON u.id = fs.user_id
         WHERE fs.known_status IS NULL OR fs.known_status != 'erledigt'
         ORDER BY fs.created_at DESC
         LIMIT 100`
      )
      .all<SubmissionRow>()
    return res.results ?? []
  } catch (err) {
    // Fallback ohne can_notify / push-Spalten (ältere Migration)
    try {
      const res = await db
        .prepare(
          `SELECT fs.id, fs.user_id, fs.github_issue_number, fs.title, fs.known_status,
                  'done' AS push_feedback_mode,
                  0 AS can_notify
           FROM feedback_submissions fs
           WHERE fs.known_status IS NULL OR fs.known_status != 'erledigt'
           ORDER BY fs.created_at DESC
           LIMIT 100`
        )
        .all<SubmissionRow>()
      return res.results ?? []
    } catch (err2) {
      console.warn('listOpenFeedbackSubmissions:', err2 ?? err)
      return []
    }
  }
}

async function updateKnownStatus(
  db: D1Database,
  id: string,
  status: FeedbackStatus,
  title?: string
): Promise<void> {
  try {
    if (title != null && title.trim()) {
      await db
        .prepare(`UPDATE feedback_submissions SET known_status = ?, title = ? WHERE id = ?`)
        .bind(status, title.trim(), id)
        .run()
    } else {
      await db
        .prepare(`UPDATE feedback_submissions SET known_status = ? WHERE id = ?`)
        .bind(status, id)
        .run()
    }
  } catch (err) {
    console.warn('updateKnownStatus failed:', err)
  }
}

export type FeedbackStatusPushResult = {
  checked: number
  notified: number
  baselines: number
  updated: number
}

export async function processFeedbackStatusPush(
  db: D1Database
): Promise<FeedbackStatusPushResult> {
  const result: FeedbackStatusPushResult = {
    checked: 0,
    notified: 0,
    baselines: 0,
    updated: 0,
  }

  if (!process.env.GITHUB_TOKEN?.trim()) {
    return result
  }

  const rows = await listOpenFeedbackSubmissions(db)
  if (rows.length === 0) return result

  result.checked = rows.length
  const numbers = [...new Set(rows.map((r) => r.github_issue_number))]

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

    // Erster Lauf: Status merken, nicht benachrichtigen
    if (previous == null) {
      await updateKnownStatus(db, row.id, live.status, live.title)
      result.baselines++
      result.updated++
      continue
    }

    if (previous === live.status) {
      // Titel still synchron halten, wenn GitHub umbenannt hat – nur bei Abweichung
      if (live.title && live.title !== row.title) {
        await updateKnownStatus(db, row.id, live.status, live.title)
        result.updated++
      }
      continue
    }

    const mode = row.push_feedback_mode === 'all' ? 'all' : 'done'
    const completed = live.status === 'erledigt'
    const shouldNotify = row.can_notify === 1 && (mode === 'all' || completed)

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

    await updateKnownStatus(db, row.id, live.status, live.title)
    result.updated++
  }

  return result
}
