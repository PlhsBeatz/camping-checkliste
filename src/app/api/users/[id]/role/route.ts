import { NextRequest, NextResponse } from 'next/server'
import { getDB, updateUserRole, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

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
    const role = body.role

    if (!id || !role || !['admin', 'kind', 'gast'].includes(role)) {
      return NextResponse.json(
        { error: 'id und role (admin|kind|gast) erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const success = await updateUserRole(db, id, role as 'admin' | 'kind' | 'gast')
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
