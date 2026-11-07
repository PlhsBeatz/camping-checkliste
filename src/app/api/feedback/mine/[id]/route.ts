import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getDB, type CloudflareEnv } from '@/lib/db'
import {
  extractFeedbackDescription,
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
  description: string | null
  created_at: string
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth

    const { id } = await context.params
    if (!id?.trim()) {
      return NextResponse.json({ success: false, error: 'ID fehlt.' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    let row: Row | null = null
    try {
      row =
        (await db
          .prepare(
            `SELECT id, github_issue_number, title, type, description, created_at
             FROM feedback_submissions
             WHERE id = ? AND user_id = ?`
          )
          .bind(id, userContext.userId)
          .first<Row>()) ?? null
    } catch {
      const legacy = await db
        .prepare(
          `SELECT id, github_issue_number, title, type, created_at
           FROM feedback_submissions
           WHERE id = ? AND user_id = ?`
        )
        .bind(id, userContext.userId)
        .first<Omit<Row, 'description'>>()
      if (legacy) {
        row = { ...legacy, description: null }
      }
    }

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Meldung nicht gefunden.' },
        { status: 404 }
      )
    }

    let status: FeedbackStatus = 'eingegangen'
    let type = row.type as FeedbackType
    let title = row.title
    let description = (row.description ?? '').trim()

    if (process.env.GITHUB_TOKEN?.trim()) {
      try {
        const live = await fetchIssuesByNumbers([row.github_issue_number], undefined, {
          includeBody: !description,
        })
        const item = live.get(row.github_issue_number)
        if (item) {
          status = item.status
          title = item.title
          if (item.type) type = item.type
          if (!description && item.description) {
            description = item.description
          }
        }
      } catch (err) {
        console.warn('GET /api/feedback/mine/[id] GitHub:', err)
      }
    }

    // Falls Body noch Metadaten enthält (Altbestand aus GitHub)
    if (description.includes('\n---\n') || description.includes('_Aus der App gemeldet_')) {
      description = extractFeedbackDescription(description)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        issueNumber: row.github_issue_number,
        title,
        description,
        type,
        status,
        statusLabel: feedbackStatusLabel(status),
        createdAt: row.created_at,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/feedback/mine/[id]', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
