/**
 * Helper für API-Route-Authentifizierung
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDB, CloudflareEnv } from '@/lib/db'
import { buildUserContext, type UserContext } from '@/lib/permissions'

export async function requireAuth(
  request: NextRequest
): Promise<{ session: Awaited<ReturnType<typeof getSession>>; userContext: UserContext } | NextResponse> {
  const session = await getSession(request)
  if (!session) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
  }
  const env = process.env as unknown as CloudflareEnv
  const db = getDB(env)
  const userContext = await buildUserContext(db, session)
  return { session, userContext }
}

export function requireAdmin(userContext: UserContext): NextResponse | null {
  if (userContext.role !== 'admin') {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }
  return null
}
