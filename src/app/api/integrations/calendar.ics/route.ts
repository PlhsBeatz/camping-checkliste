import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireIntegrationAuth } from '@/lib/integration-auth'
import { getOrBuildIcalBody } from '@/lib/integration-ical'
import { parseIcalView, parseIncludeDeparture } from '@/lib/ical-vacations'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireIntegrationAuth(request, {
      allowQueryToken: true,
      purpose: 'calendar',
    })
    if (auth instanceof NextResponse) return auth

    const view = parseIcalView(request.nextUrl.searchParams.get('view'))
    if (!view) {
      return NextResponse.json(
        { error: 'view muss summary oder stays sein' },
        { status: 400 }
      )
    }
    const includeDeparture = parseIncludeDeparture(
      request.nextUrl.searchParams.get('include_departure')
    )

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = await getOrBuildIcalBody(db, view, includeDeparture)

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Content-Disposition': 'inline; filename="urlaube.ics"',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
