import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireSystemAdmin } from '@/lib/api-auth'
import {
  ensureCalendarIntegrationToken,
  rotateCalendarIntegrationToken,
} from '@/lib/integration-db'
import { ICAL_FEED_META } from '@/lib/ical-vacations'

function buildFeedUrls(origin: string, token: string) {
  return ICAL_FEED_META.map((meta) => {
    const params = new URLSearchParams()
    params.set('token', token)
    params.set('view', meta.view)
    if (meta.includeDeparture) params.set('include_departure', '1')
    return {
      feedKey: meta.feedKey,
      label: meta.label,
      description: meta.description,
      path: `/api/integrations/calendar.ics?${params.toString()}`,
      url: `${origin}/api/integrations/calendar.ics?${params.toString()}`,
    }
  })
}

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) return `${proto}://${host}`
  return request.nextUrl.origin
}

/** Aktiven Kalender-Token laden bzw. automatisch anlegen. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireSystemAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ensured = await ensureCalendarIntegrationToken(db)
    if (!ensured) {
      return NextResponse.json(
        { error: 'Kalender-Token konnte nicht erstellt werden' },
        { status: 500 }
      )
    }

    const origin = requestOrigin(request)
    return NextResponse.json({
      success: true,
      data: {
        token: ensured.token,
        created: ensured.created,
        feeds: buildFeedUrls(origin, ensured.token),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Kalender-Token rotieren (widerruft den bisherigen). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireSystemAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const rotated = await rotateCalendarIntegrationToken(db)
    if (!rotated) {
      return NextResponse.json(
        { error: 'Kalender-Token konnte nicht erneuert werden' },
        { status: 500 }
      )
    }

    const origin = requestOrigin(request)
    return NextResponse.json({
      success: true,
      data: {
        token: rotated.token,
        feeds: buildFeedUrls(origin, rotated.token),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
