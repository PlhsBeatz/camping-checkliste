import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getDB, type CloudflareEnv } from '@/lib/db'
import {
  fetchIssuesByNumbers,
  feedbackStatusLabel,
  isFeedbackStatus,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/github-feedback'

type Row = {
  id: string
  github_issue_number: number
  title: string
  type: string
  created_at: string
  known_status: string | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    let rows: Row[] = []
    try {
      const { results } = await db
        .prepare(
          `SELECT id, github_issue_number, title, type, created_at, known_status
           FROM feedback_submissions
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 50`
        )
        .bind(userContext.userId)
        .all<Row>()
      rows = results ?? []
    } catch {
      const { results } = await db
        .prepare(
          `SELECT id, github_issue_number, title, type, created_at
           FROM feedback_submissions
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 50`
        )
        .bind(userContext.userId)
        .all<Omit<Row, 'known_status'>>()
      rows = (results ?? []).map((r) => ({ ...r, known_status: null }))
    }

    // Nur fehlende known_status von GitHub nachziehen (kein Full-Refresh pro Aufruf)
    const needsLive = rows.filter((r) => !isFeedbackStatus(r.known_status))
    const liveByNumber = new Map<
      number,
      { status: FeedbackStatus; type: FeedbackType | null; title: string }
    >()

    if (needsLive.length > 0 && process.env.GITHUB_TOKEN?.trim()) {
      try {
        const numbers = needsLive.map((r) => r.github_issue_number)
        const live = await fetchIssuesByNumbers(numbers)
        for (const [num, item] of live.entries()) {
          liveByNumber.set(num, {
            status: item.status,
            type: item.type,
            title: item.title,
          })
        }

        // D1 nachziehen, damit Folgeläufe ohne GitHub auskommen
        for (const row of needsLive) {
          const liveItem = liveByNumber.get(row.github_issue_number)
          if (!liveItem) continue
          try {
            await db
              .prepare(
                `UPDATE feedback_submissions
                 SET known_status = ?, title = ?
                 WHERE id = ? AND user_id = ?`
              )
              .bind(liveItem.status, liveItem.title || row.title, row.id, userContext.userId)
              .run()
          } catch {
            /* Spalte ggf. noch nicht da */
          }
        }
      } catch (err) {
        console.warn('fetchIssuesByNumbers (mine backfill) failed:', err)
      }
    }

    const data = rows.map((row) => {
      const live = liveByNumber.get(row.github_issue_number)
      const status: FeedbackStatus =
        live?.status ??
        (isFeedbackStatus(row.known_status) ? row.known_status : 'eingegangen')
      const type = (live?.type ?? row.type) as FeedbackType
      return {
        id: row.id,
        issueNumber: row.github_issue_number,
        title: live?.title ?? row.title,
        type,
        status,
        statusLabel: feedbackStatusLabel(status),
        createdAt: row.created_at,
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/feedback/mine', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
