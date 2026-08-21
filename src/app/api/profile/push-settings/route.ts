import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getUserPushSettings, updateUserPushSettings } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { isAdminRole } from '@/lib/user-roles'
import type { UserPushSettings } from '@/lib/push-settings'

function parseBody(body: unknown): UserPushSettings | null {
  if (!body || typeof body !== 'object') return null
  const o = body as Record<string, unknown>
  if (typeof o.enabled !== 'boolean') return null
  if (typeof o.rastplatzNearby !== 'boolean') return null
  if (typeof o.optimierungFaelligkeit !== 'boolean') return null
  return {
    enabled: o.enabled,
    rastplatzNearby: o.rastplatzNearby,
    optimierungFaelligkeit: o.optimierungFaelligkeit,
  }
}

function toResponseData(
  settings: UserPushSettings & { browserSubscribed?: boolean }
) {
  return {
    enabled: settings.enabled,
    rastplatzNearby: settings.rastplatzNearby,
    optimierungFaelligkeit: settings.optimierungFaelligkeit,
    browserSubscribed: settings.browserSubscribed ?? false,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const settings = await getUserPushSettings(db, auth.userContext.userId)
    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Push-Einstellungen konnten nicht geladen werden.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: toResponseData(settings),
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
        {
          success: false,
          error: 'enabled, rastplatzNearby und optimierungFaelligkeit (boolean) erforderlich',
        },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    // Optimierungen-Push nur Admins/System-Admins – Präferenz für andere unverändert lassen
    const existing = await getUserPushSettings(db, auth.userContext.userId)
    const toSave: UserPushSettings = isAdminRole(auth.userContext.role)
      ? parsed
      : {
          ...parsed,
          optimierungFaelligkeit: existing?.optimierungFaelligkeit ?? true,
        }

    const ok = await updateUserPushSettings(db, auth.userContext.userId, toSave)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    const settings = await getUserPushSettings(db, auth.userContext.userId)
    return NextResponse.json({
      success: true,
      data: settings ? toResponseData(settings) : toSave,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
