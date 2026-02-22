import { NextRequest, NextResponse } from 'next/server'
import { getDB, getInvitationByToken, acceptInvitation, createUser, updateMitreisenderUserId, CloudflareEnv } from '@/lib/db'
import { hashPassword, createToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token fehlt' }, { status: 400 })
  }

  const env = process.env as unknown as CloudflareEnv
  const db = getDB(env)
  const invitation = await getInvitationByToken(db, token)
  if (!invitation) {
    return NextResponse.json(
      { success: false, error: 'Einladung ungültig oder bereits angenommen' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    mitreisender_name: invitation.mitreisender_name,
    role: invitation.role,
    token
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string
      email?: string
      password?: string
    }
    const { token, email, password } = body

    if (!token || !email?.trim() || !password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Token, E-Mail und Passwort (min. 6 Zeichen) erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const invitation = await getInvitationByToken(db, token)
    if (!invitation) {
      return NextResponse.json(
        { success: false, error: 'Einladung ungültig oder bereits angenommen' },
        { status: 404 }
      )
    }

    const passwordHash = await hashPassword(password)
    const userId = await createUser(
      db,
      email.trim().toLowerCase(),
      passwordHash,
      invitation.role,
      invitation.mitreisender_id
    )
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'E-Mail möglicherweise bereits vergeben' },
        { status: 400 }
      )
    }

    await updateMitreisenderUserId(db, invitation.mitreisender_id, userId)
    await acceptInvitation(db, invitation.id)

    const jwt = await createToken({
      id: userId,
      email: email.trim().toLowerCase(),
      role: invitation.role,
      mitreisender_id: invitation.mitreisender_id
    })

    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })
    return response
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json(
      { success: false, error: 'Registrierung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
