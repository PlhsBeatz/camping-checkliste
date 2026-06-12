/**
 * Server-only Auth-Helfer (Next.js cookies).
 * Nicht aus Client Components importieren.
 */

import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import type { SessionUser } from '@/lib/user-roles'

/** Session aus Next.js cookies (Server Components) */
export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = await verifyToken(token)
  if (!payload) return null
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    mitreisender_id: payload.mitreisender_id ?? null
  }
}
