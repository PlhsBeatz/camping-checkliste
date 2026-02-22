import { NextRequest, NextResponse } from 'next/server'
import { getDB, getUsersCount, createUser, CloudflareEnv } from '@/lib/db'
import { hashPassword, createToken } from '@/lib/auth'

/**
 * Bootstrap: Erstellt den ersten Admin, wenn noch keine User existieren.
 * Body: { email, password }
 * Sollte nach dem ersten Aufruf deaktiviert oder geschützt werden.
 */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const count = await getUsersCount(db)
    if (count > 0) {
      return NextResponse.json(
        { success: false, error: 'Bootstrap bereits durchgeführt. Es existieren bereits Benutzer.' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as { email?: string; password?: string }
    const email = body.email?.trim()
    const password = body.password

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'E-Mail und Passwort (min. 6 Zeichen) erforderlich' },
        { status: 400 }
      )
    }

    const userId = await createUser(db, email, await hashPassword(password), 'admin', null)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Benutzer konnte nicht erstellt werden' },
        { status: 500 }
      )
    }

    const jwt = await createToken({
      id: userId,
      email,
      role: 'admin',
      mitreisender_id: null
    })

    const response = NextResponse.json({ success: true, message: 'Admin erstellt' })
    response.cookies.set('auth-token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })
    return response
  } catch (error) {
    console.error('Bootstrap error:', error)
    return NextResponse.json(
      { success: false, error: 'Bootstrap fehlgeschlagen' },
      { status: 500 }
    )
  }
}
