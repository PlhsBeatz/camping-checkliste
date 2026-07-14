import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getUserPushSettings } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { sendPushToUser } from '@/lib/web-push'
import { isPushNotificationPayload } from '@/lib/push-notifications'
import { isPushTypeEnabled } from '@/lib/push-settings'

/**
 * Client triggert Push (PWA hat GPS, SW nicht).
 * Akzeptiert typisierte Payloads – neue Typen in push-notifications.ts registrieren.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body: unknown = await request.json()
    if (!isPushNotificationPayload(body)) {
      return NextResponse.json(
        { success: false, error: 'Ungültiges Push-Payload (schema_version, type, title, body, tag)' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const pushSettings = await getUserPushSettings(db, auth.userContext.userId)
    if (!pushSettings?.enabled) {
      return NextResponse.json({
        success: true,
        data: {
          sent: 0,
          failed: 0,
          hint: 'Push-Benachrichtigungen sind im Profil deaktiviert.',
        },
      })
    }
    if (!isPushTypeEnabled(body.type, pushSettings)) {
      return NextResponse.json({
        success: true,
        data: {
          sent: 0,
          failed: 0,
          hint: `Push-Typ „${body.type}“ ist in deinen Profil-Einstellungen deaktiviert.`,
        },
      })
    }

    const result = await sendPushToUser(db, auth.userContext.userId, body)

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        ...(result.sent === 0 && result.failed === 0
          ? {
              hint:
                'Kein Push-Abo für diesen Benutzer. Im Profil Push aktivieren und Benachrichtigungen im Browser erlauben.',
            }
          : {}),
        ...(result.sent === 0 && result.failed > 0 && result.errors?.length
          ? {
              hint:
                'Versand fehlgeschlagen – siehe errors[]. Bei 410: Push im Profil neu aktivieren. Bei 401/403: VAPID-Schlüssel prüfen.',
            }
          : {}),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
