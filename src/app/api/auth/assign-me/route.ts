import { NextRequest, NextResponse } from 'next/server'
import { getDB, updateUserMitreisender, updateMitreisenderUserId, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

/**
 * Ordnet den aktuell eingeloggten Admin einem Mitreisenden zu.
 * Nur wenn der Mitreisende noch keinen User hat.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminCheck = requireAdmin(auth.userContext)
    if (adminCheck) return adminCheck

    const body = (await request.json()) as { mitreisenderId?: string }
    const mitreisenderId = body.mitreisenderId

    if (!mitreisenderId) {
      return NextResponse.json(
        { success: false, error: 'mitreisenderId erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const mitreisender = await db
      .prepare('SELECT user_id FROM mitreisende WHERE id = ?')
      .bind(mitreisenderId)
      .first<{ user_id: string | null }>()

    if (!mitreisender) {
      return NextResponse.json(
        { success: false, error: 'Mitreisender nicht gefunden' },
        { status: 404 }
      )
    }
    if (mitreisender.user_id) {
      return NextResponse.json(
        { success: false, error: 'Dieser Mitreisende hat bereits einen zugeordneten Benutzer' },
        { status: 400 }
      )
    }

    const userId = auth.userContext.userId
    await updateUserMitreisender(db, userId, mitreisenderId)
    await updateMitreisenderUserId(db, mitreisenderId, userId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Assign-me error:', error)
    return NextResponse.json(
      { success: false, error: 'Zuordnung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
