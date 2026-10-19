import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getDB, type CloudflareEnv } from '@/lib/db'
import {
  fetchIssuesByNumbers,
  feedbackStatusLabel,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/github-feedback'

type Row = {
  id: string
  github_issue_number: number
  title: string
  type: string
  created_at: string
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const { results } = await db
      .prepare(
        `SELECT id, github_issue_number, title, type, created_at
         FROM feedback_submissions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 50`
      )
      .bind(userContext.userId)
      .all<Row>()

    const rows = results ?? []
    const numbers = rows.map((r) => r.github_issue_number)

    let statusMap = new Map<
      number,
      { status: FeedbackStatus; type: FeedbackType | null; title: string }
    >()

    if (numbers.length > 0 && process.env.GITHUB_TOKEN?.trim()) {
      try {
        const live = await fetchIssuesByNumbers(numbers)
        statusMap = new Map(
          [...live.entries()].map(([num, item]) => [
            num,
            { status: item.status, type: item.type, title: item.title },
          ])
        )
      } catch (err) {
        console.warn('fetchIssuesByNumbers failed:', err)
      }
    }

    const data = rows.map((row) => {
      const live = statusMap.get(row.github_issue_number)
      const status: FeedbackStatus = live?.status ?? 'offen'
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
