import { NextRequest, NextResponse } from 'next/server'
import { getDB, getUsers, CloudflareEnv } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Nur Administratoren können Benutzer auflisten' },
        { status: 403 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const users = await getUsers(db)
    return NextResponse.json({ success: true, users })
  } catch (error) {
    console.error('Users list error:', error)
    return NextResponse.json(
      { success: false, error: 'Fehler beim Laden der Benutzer' },
      { status: 500 }
    )
  }
}
