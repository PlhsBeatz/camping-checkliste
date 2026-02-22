import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDB, createInvitation, CloudflareEnv } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Nur Administratoren können Einladungen erstellen' },
        { status: 403 }
      )
    }

    const body = (await request.json()) as {
      mitreisenderId?: string
      role?: 'kind' | 'gast'
    }
    const { mitreisenderId, role } = body

    if (!mitreisenderId || !role || (role !== 'kind' && role !== 'gast')) {
      return NextResponse.json(
        { success: false, error: 'mitreisenderId und role (kind|gast) erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const invite = await createInvitation(db, mitreisenderId, role, session.id)
    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Einladung konnte nicht erstellt werden' },
        { status: 500 }
      )
    }

    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    const proto = request.headers.get('x-forwarded-proto') ?? (host?.includes('localhost') ? 'http' : 'https')
    const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? '')
    const link = `${baseUrl}/einladung/${invite.token}`

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      token: invite.token,
      link
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Erstellen der Einladung' },
      { status: 500 }
    )
  }
}
