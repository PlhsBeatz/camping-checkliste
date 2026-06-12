import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { isAdminRole, isSystemAdminRole } from '@/lib/auth'
import { getDB, getUserById, getMitreisendeBerechtigungen, getMitreisenderStammdaten, CloudflareEnv } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ success: false, user: null }, { status: 401 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const user = await getUserById(db, session.id)
    if (!user) {
      return NextResponse.json({ success: false, user: null }, { status: 401 })
    }

    let permissions: string[] = []
    let personentyp: 'erwachsen' | 'kind' | null = null
    let gruppe_id: string | null = null

    if (user.mitreisender_id) {
      permissions = await getMitreisendeBerechtigungen(db, user.mitreisender_id)
      const stamm = await getMitreisenderStammdaten(db, user.mitreisender_id)
      if (stamm) {
        personentyp = stamm.personentyp
        gruppe_id = stamm.gruppe_id
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mitreisender_id: user.mitreisender_id,
        personentyp,
        gruppe_id,
        permissions,
        must_change_password: !!(user as { must_change_password?: number }).must_change_password,
        is_system_admin: isSystemAdminRole(user.role),
        is_admin: isAdminRole(user.role),
      },
    })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ success: false, user: null }, { status: 500 })
  }
}
