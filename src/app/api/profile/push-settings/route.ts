import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getUserPushSettings, updateUserPushSettings } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import type { UserPushSettings } from '@/lib/push-settings'

function parseBody(body: unknown): UserPushSettings | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  if (typeof o.enabled !== 'boolean') return null
  if (typeof o.rastplatzNearby !== 'boolean') return null
  return { enabled: o.enabled, rastplatzNearby: o.rastplatzNearby }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const settings = await getUserPushSettings(db, auth.userContext.userId)
    if (!settings) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        enabled: settings.enabled,
        rastplatzNearby: settings.rastplatzNearby,
        browserSubscribed: settings.browserSubscribed,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const parsed = parseBody(await request.json())
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'enabled und rastplatzNearby (boolean) erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await updateUserPushSettings(db, auth.userContext.userId, parsed)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    const settings = await getUserPushSettings(db, auth.userContext.userId)
    return NextResponse.json({
      success: true,
      data: settings
        ? {
            enabled: settings.enabled,
            rastplatzNearby: settings.rastplatzNearby,
            browserSubscribed: settings.browserSubscribed,
          }
        : parsed,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
