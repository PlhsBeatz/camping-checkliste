/**
 * Helper für API-Route-Authentifizierung
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession, isAdminRole, isSystemAdminRole } from '@/lib/auth'
import { getDB, getUserById, CloudflareEnv } from '@/lib/db'
import { buildUserContext, type UserContext } from '@/lib/permissions'

export async function requireAuth(
  request: NextRequest
): Promise<{ session: Awaited<ReturnType<typeof getSession>>; userContext: UserContext } | NextResponse> {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const env = process.env as unknown as CloudflareEnv
  const db = await getDB(env)
  const user = await getUserById(db, session.id)
  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const userContext = await buildUserContext(db, {
    id: user.id,
    email: user.email,
    role: user.role,
    mitreisender_id: user.mitreisender_id,
  })
  return { session, userContext }
}

/** Haushalt-Admin oder System-Admin */
export function requireAdmin(userContext: UserContext): NextResponse | null {
  if (!isAdminRole(userContext.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  return null
}

/** Nur System-Admin (Import/Export, Rollenvergabe system_admin) */
export function requireSystemAdmin(userContext: UserContext): NextResponse | null {
  if (!isSystemAdminRole(userContext.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung (System-Admin erforderlich)' }, { status: 403 })
  }
  return null
}
