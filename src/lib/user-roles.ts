/** Nutzerrollen — client- und server-tauglich (ohne next/headers). */

export type UserRole = 'system_admin' | 'admin' | 'standard'

export function isAdminRole(role: UserRole): boolean {
  return role === 'admin' || role === 'system_admin'
}

export function isSystemAdminRole(role: UserRole): boolean {
  return role === 'system_admin'
}

export interface SessionUser {
  id: string
  email: string
  role: UserRole
  mitreisender_id: string | null
}
