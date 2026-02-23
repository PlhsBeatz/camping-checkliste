import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDB, getUserById, updateUserPassword, CloudflareEnv } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

/** Zufälliges sicheres Passwort (12 Zeichen, Buchstaben + Ziffern) */
function generateTemporaryPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Nur Administratoren können Passwörter zurücksetzen' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as { userId?: string; newPassword?: string }
    const { userId, newPassword } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Benutzer-ID erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const targetUser = await getUserById(db, userId)
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Benutzer nicht gefunden' },
        { status: 404 }
      )
    }

    const temporaryPassword = newPassword && newPassword.length >= 6
      ? newPassword
      : generateTemporaryPassword()

    const passwordHash = await hashPassword(temporaryPassword)
    const ok = await updateUserPassword(db, userId, passwordHash, true)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Passwort konnte nicht aktualisiert werden' },
        { status: 500 }
      )
    }

    if (newPassword && newPassword.length >= 6) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({
      success: true,
      temporaryPassword,
      email: targetUser.email
    })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Zurücksetzen' },
      { status: 500 }
    )
  }
}
