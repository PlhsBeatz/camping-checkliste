import { NextRequest, NextResponse } from 'next/server'
import { getDB, updateUserRole, CloudflareEnv } from '@/lib/db'
import type { UserRole } from '@/lib/auth'
import { isSystemAdminRole } from '@/lib/auth'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

const ASSIGNABLE_BY_ADMIN: UserRole[] = ['admin', 'standard']
const ASSIGNABLE_BY_SYSTEM: UserRole[] = ['system_admin', 'admin', 'standard']

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminCheck = requireAdmin(auth.userContext)
    if (adminCheck) return adminCheck

    const { id } = await params
    const body = (await request.json()) as { role?: string }
    const role = body.role as UserRole | undefined

    if (!id || !role) {
      return NextResponse.json({ error: 'id und role erforderlich' }, { status: 400 })
    }

    const allowed = isSystemAdminRole(auth.userContext.role)
      ? ASSIGNABLE_BY_SYSTEM
      : ASSIGNABLE_BY_ADMIN

    if (!allowed.includes(role)) {
      return NextResponse.json(
        {
          error: isSystemAdminRole(auth.userContext.role)
            ? 'Ungültige Rolle'
            : 'Nur system_admin kann die Rolle system_admin vergeben',
        },
        { status: 403 }
      )
    }

    if (role === 'system_admin' && !isSystemAdminRole(auth.userContext.role)) {
      return NextResponse.json(
        { error: 'Nur System-Administratoren können system_admin vergeben' },
        { status: 403 }
      )
    }

    if (id === auth.userContext.userId && role !== auth.userContext.role) {
      if (isSystemAdminRole(auth.userContext.role) && role !== 'system_admin') {
        return NextResponse.json(
          { error: 'Sie können Ihre eigene system_admin-Rolle nicht entfernen' },
          { status: 400 }
        )
      }
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const success = await updateUserRole(db, id, role)
    if (!success) {
      return NextResponse.json({ error: 'Rolle konnte nicht geändert werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user role:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
