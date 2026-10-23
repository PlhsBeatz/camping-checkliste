import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getDB, type CloudflareEnv } from '@/lib/db'
import {
  buildFeedbackIssueBody,
  createFeedbackIssue,
  type FeedbackType,
} from '@/lib/github-feedback'
import { formatAppVersionDisplay } from '@/lib/app-version'

const MAX_TITLE = 120
const MAX_DESCRIPTION = 4000
const RATE_LIMIT_PER_DAY = 5

function isFeedbackType(v: unknown): v is FeedbackType {
  return v === 'bug' || v === 'enhancement'
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth

    if (!process.env.GITHUB_TOKEN?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Feedback ist noch nicht konfiguriert (GITHUB_TOKEN fehlt).',
        },
        { status: 503 }
      )
    }

    const body = (await request.json()) as {
      title?: string
      description?: string
      type?: string
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description =
      typeof body.description === 'string' ? body.description.trim() : ''
    const type = body.type

    if (!title || title.length > MAX_TITLE) {
      return NextResponse.json(
        { success: false, error: `Titel erforderlich (max. ${MAX_TITLE} Zeichen).` },
        { status: 400 }
      )
    }
    if (!description || description.length > MAX_DESCRIPTION) {
      return NextResponse.json(
        {
          success: false,
          error: `Beschreibung erforderlich (max. ${MAX_DESCRIPTION} Zeichen).`,
        },
        { status: 400 }
      )
    }
    if (!isFeedbackType(type)) {
      return NextResponse.json(
        { success: false, error: 'Typ muss bug oder enhancement sein.' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as c FROM feedback_submissions
         WHERE user_id = ? AND created_at >= datetime('now', 'start of day')`
      )
      .bind(userContext.userId)
      .first<{ c: number }>()

    if ((countRow?.c ?? 0) >= RATE_LIMIT_PER_DAY) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximal ${RATE_LIMIT_PER_DAY} Meldungen pro Tag.`,
        },
        { status: 429 }
      )
    }

    const issueBody = buildFeedbackIssueBody({
      description,
      type,
      userEmail: userContext.email,
      userId: userContext.userId,
      userAgent: request.headers.get('user-agent'),
      appVersion: formatAppVersionDisplay(),
    })

    const issue = await createFeedbackIssue({
      title,
      body: issueBody,
      type,
    })

    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO feedback_submissions (id, user_id, github_issue_number, title, type, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, userContext.userId, issue.number, title, type)
      .run()

    return NextResponse.json({
      success: true,
      data: {
        id,
        issueNumber: issue.number,
        title,
        type,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('POST /api/feedback', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
