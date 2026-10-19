import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getUserPushSettings, getVacation } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { notifyVerbrauchEndstandForVacation } from '@/lib/verbrauch-endstand-push'
import { isPushTypeEnabled } from '@/lib/push-settings'

/**
 * Client: Heimkehr erkannt → Endstand-Push einmalig auslösen.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as { urlaubId?: string }
    const urlaubId = typeof body.urlaubId === 'string' ? body.urlaubId.trim() : ''
    if (!urlaubId) {
      return NextResponse.json(
        { success: false, error: 'urlaubId erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vacation = await getVacation(db, urlaubId)
    if (!vacation) {
      return NextResponse.json(
        { success: false, error: 'Urlaub nicht gefunden' },
        { status: 404 }
      )
    }

    const pushSettings = await getUserPushSettings(db, auth.userContext.userId)
    if (!pushSettings?.enabled || !isPushTypeEnabled('verbrauch_endstand', pushSettings)) {
      return NextResponse.json({
        success: true,
        data: {
          notified: false,
          alreadySent: false,
          mediaNames: [] as string[],
          hint: 'Push für Verbrauchs-Endstände ist deaktiviert.',
        },
      })
    }

    const result = await notifyVerbrauchEndstandForVacation(db, {
      urlaubId: vacation.id,
      urlaubTitel: vacation.titel,
      userId: auth.userContext.userId,
    })

    return NextResponse.json({
      success: true,
      data: {
        notified: result.notified,
        alreadySent: result.alreadySent,
        mediaNames: result.mediaNames,
        pushes: result.pushes,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
