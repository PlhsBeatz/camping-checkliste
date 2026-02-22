/**
 * Berechtigungslogik für rollenbasierte Zugriffskontrolle
 */

import type { UserRole } from './auth'
import type { D1Database } from '@cloudflare/workers-types'
import { getMitreisendeBerechtigungen } from './db'

export interface UserContext {
  userId: string
  email: string
  role: UserRole
  mitreisenderId: string | null
  permissions: string[]
}

/** Admin hat vollen Zugriff */
export function canAccessConfig(ctx: UserContext): boolean {
  return ctx.role === 'admin'
}

/** Nur Admin darf Ausrüstung bearbeiten */
export function canWriteEquipment(ctx: UserContext): boolean {
  return ctx.role === 'admin'
}

/** Nur Admin darf andere Packprofile auswählen */
export function canSelectOtherProfiles(ctx: UserContext): boolean {
  return ctx.role === 'admin'
}

/** Kind: alle Urlaube; Gast: nur zugewiesene */
export function canAccessVacation(
  ctx: UserContext,
  vacationMitreisendeIds: string[]
): boolean {
  if (ctx.role === 'admin') return true
  if (ctx.role === 'kind') return true
  if (ctx.role === 'gast' && ctx.mitreisenderId) {
    return vacationMitreisendeIds.includes(ctx.mitreisenderId)
  }
  return false
}

/** Konfigurierbare Berechtigung prüfen (bereits aus DB geladen in ctx.permissions) */
export function hasPermission(ctx: UserContext, key: string): boolean {
  return ctx.permissions.includes(key)
}

/** Darf Kind oder Gast pauschal Einträge bearbeiten? (Checkbox bei Kind & Gast) */
export function canEditPauschalEntries(ctx: UserContext): boolean {
  if (ctx.role === 'admin') return true
  return hasPermission(ctx, 'can_edit_pauschal_entries')
}

/** Gepackt-Status erfordert Elternkontrolle (vorgemerkt statt final) */
export function gepacktRequiresParentApproval(ctx: UserContext): boolean {
  if (ctx.role === 'admin') return false
  return hasPermission(ctx, 'gepackt_erfordert_elternkontrolle')
}

/** UserContext aus Session + DB-Permissions aufbauen */
export async function buildUserContext(
  db: D1Database,
  session: { id: string; email: string; role: UserRole; mitreisender_id: string | null }
): Promise<UserContext> {
  let permissions: string[] = []
  if (session.mitreisender_id) {
    permissions = await getMitreisendeBerechtigungen(db, session.mitreisender_id)
  }
  return {
    userId: session.id,
    email: session.email,
    role: session.role,
    mitreisenderId: session.mitreisender_id,
    permissions
  }
}
