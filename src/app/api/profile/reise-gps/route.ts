import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getUserReiseGpsMode, updateUserReiseGpsMode } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { parseReiseGpsMode, type ReiseGpsMode } from '@/lib/reise-gps-settings'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const mode = await getUserReiseGpsMode(db, auth.userContext.userId)
    if (!mode) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: { mode } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as { mode?: unknown }
    const mode = parseReiseGpsMode(body.mode)
    if (body.mode !== 'auto' && body.mode !== 'on' && body.mode !== 'off') {
      return NextResponse.json(
        { success: false, error: 'mode muss auto, on oder off sein' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await updateUserReiseGpsMode(db, auth.userContext.userId, mode)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { mode } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
