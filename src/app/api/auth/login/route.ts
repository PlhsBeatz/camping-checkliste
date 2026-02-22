import { NextRequest, NextResponse } from 'next/server'
import { getDB, getUserByEmail, CloudflareEnv } from '@/lib/db'
import { hashPassword, verifyPassword, createToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = body.email?.trim()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'E-Mail und Passwort erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const user = await getUserByEmail(db, email)

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Ungültige E-Mail oder Passwort' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { success: false, error: 'Ungültige E-Mail oder Passwort' },
        { status: 401 }
      )
    }

    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      mitreisender_id: user.mitreisender_id
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Login fehlgeschlagen' },
      { status: 500 }
    )
  }
}
