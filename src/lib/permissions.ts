/**
 * Berechtigungslogik für rollenbasierte Zugriffskontrolle
 */

import type { UserRole } from './user-roles'
import { isAdminRole } from './user-roles'
import type { D1Database } from '@cloudflare/workers-types'
import { getMitreisendeBerechtigungen, getMitreisenderStammdaten } from './db'
import type { Personentyp } from './db'

export interface UserContext {
  userId: string
  email: string
  role: UserRole
  mitreisenderId: string | null
  /** Personentyp des verknüpften Mitreisenden */
  personentyp: Personentyp | null
  /** Reisegruppe des verknüpften Mitreisenden */
  gruppeId: string | null
  permissions: string[]
}

/** Admin oder System-Admin: Konfigurationsbereiche */
export function canAccessConfig(ctx: UserContext): boolean {
  return isAdminRole(ctx.role)
}

export function canWriteEquipment(ctx: UserContext): boolean {
  return isAdminRole(ctx.role)
}

/** Admin: alle Profile; Standard+Erwachsen: Gruppenmitglieder (Filter im UI/API nach Urlaub) */
export function canSelectOtherProfiles(ctx: UserContext): boolean {
  if (isAdminRole(ctx.role)) return true
  if (ctx.role === 'standard' && ctx.personentyp === 'erwachsen') return true
  return false
}

/** Admin/System: alle Urlaube; Standard: nur wenn eigener Mitreisender am Urlaub teilnimmt */
export function canAccessVacation(
  ctx: UserContext,
  vacationMitreisendeIds: string[]
): boolean {
  if (isAdminRole(ctx.role)) return true
  if (ctx.role === 'standard' && ctx.mitreisenderId) {
    return vacationMitreisendeIds.includes(ctx.mitreisenderId)
  }
  return false
}

export function hasPermission(ctx: UserContext, key: string): boolean {
  return ctx.permissions.includes(key)
}

export function canEditPauschalEntries(ctx: UserContext): boolean {
  if (isAdminRole(ctx.role)) return true
  return hasPermission(ctx, 'can_edit_pauschal_entries')
}

/** Elternkontrolle nur für Personentyp kind mit gesetztem Flag */
export function gepacktRequiresParentApproval(ctx: UserContext): boolean {
  if (isAdminRole(ctx.role)) return false
  if (ctx.personentyp !== 'kind') return false
  return hasPermission(ctx, 'gepackt_erfordert_elternkontrolle')
}

/** Darf ein Erwachsener (Standard) Vorgemerkt für ein Kind freigeben? */
export function canConfirmVorgemerktForChild(
  ctx: UserContext,
  child: { personentyp: Personentyp; gruppe_id: string | null },
  childPermissions: string[]
): boolean {
  if (isAdminRole(ctx.role)) return true
  if (ctx.role !== 'standard' || ctx.personentyp !== 'erwachsen') return false
  if (child.personentyp !== 'kind') return false
  if (!childPermissions.includes('gepackt_erfordert_elternkontrolle')) return false
  if (!ctx.gruppeId || ctx.gruppeId !== child.gruppe_id) return false
  return true
}

/** Pack-Zuordnung: darf Actor das Ziel-Mitreisenden-Profil bearbeiten? */
export function canEditPackProfileForMitreisender(
  ctx: UserContext,
  target: { id: string; personentyp: Personentyp; gruppe_id: string | null },
  vacationMitreisendeIds: string[]
): boolean {
  if (!vacationMitreisendeIds.includes(target.id)) return false
  if (isAdminRole(ctx.role)) return true
  if (ctx.role === 'standard' && ctx.personentyp === 'erwachsen' && ctx.gruppeId) {
    return target.gruppe_id === ctx.gruppeId
  }
  if (ctx.role === 'standard' && ctx.personentyp === 'kind') {
    return ctx.mitreisenderId === target.id
  }
  return false
}

export async function buildUserContext(
  db: D1Database,
  session: { id: string; email: string; role: UserRole; mitreisender_id: string | null }
): Promise<UserContext> {
  let permissions: string[] = []
  let personentyp: Personentyp | null = null
  let gruppeId: string | null = null

  if (session.mitreisender_id) {
    permissions = await getMitreisendeBerechtigungen(db, session.mitreisender_id)
    const stamm = await getMitreisenderStammdaten(db, session.mitreisender_id)
    if (stamm) {
      personentyp = stamm.personentyp
      gruppeId = stamm.gruppe_id
    }
  }

  return {
    userId: session.id,
    email: session.email,
    role: session.role,
    mitreisenderId: session.mitreisender_id,
    personentyp,
    gruppeId,
    permissions,
  }
}
