import type { UserRole } from '@/lib/user-roles'
import type { Personentyp } from '@/lib/db'

export function userRoleLabel(role: UserRole | null | undefined): string {
  if (!role) return ''
  switch (role) {
    case 'system_admin':
      return 'System-Admin'
    case 'admin':
      return 'Admin'
    case 'standard':
      return 'Standard'
    default:
      return role
  }
}

export function personentypLabel(typ: Personentyp | null | undefined): string {
  if (typ === 'kind') return 'Kind'
  return 'Erwachsen'
}
