import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDB, getUserById, updateUserPassword, clearUserMustChangePassword, CloudflareEnv } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth'

/**
 * Eigenes Passwort ändern.
 * - Wenn must_change_password: nur newPassword nötig (erste Anmeldung nach Admin-Reset).
 * - Sonst: currentPassword + newPassword nötig.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Nicht angemeldet' },
        { status: 401 }
      )
    }

    const body = (await request.json()) as {
      currentPassword?: string
      newPassword?: string
    }
    const { currentPassword, newPassword } = body

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Neues Passwort (min. 6 Zeichen) erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const user = await getUserById(db, session.id)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 401 }
      )
    }

    const mustChange = !!(user as { must_change_password?: number }).must_change_password

    if (!mustChange) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Aktuelles Passwort erforderlich' },
          { status: 400 }
        )
      }
      const valid = await verifyPassword(currentPassword, user.password_hash)
      if (!valid) {
        return NextResponse.json(
          { success: false, error: 'Aktuelles Passwort ist falsch' },
          { status: 400 }
        )
      }
    }

    const passwordHash = await hashPassword(newPassword)
    const ok = await updateUserPassword(db, session.id, passwordHash, false)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Passwort konnte nicht geändert werden' },
        { status: 500 }
      )
    }
    await clearUserMustChangePassword(db, session.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Ändern des Passworts' },
      { status: 500 }
    )
  }
}
