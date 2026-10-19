import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import {
  fetchRoadmapIssues,
  feedbackStatusLabel,
} from '@/lib/github-feedback'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    if (!process.env.GITHUB_TOKEN?.trim()) {
      return NextResponse.json({ success: true, data: [] })
    }

    const items = await fetchRoadmapIssues()
    const data = items.map((item) => ({
      issueNumber: item.issueNumber,
      title: item.title,
      type: item.type,
      status: item.status,
      statusLabel: feedbackStatusLabel(item.status),
    }))

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('GET /api/feedback/roadmap', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
