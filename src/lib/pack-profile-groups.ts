import type { Mitreisender } from '@/lib/db'
import { sortMitreisendeNachRolleUndName } from '@/lib/mitreisenden-sort'

export interface PackProfileGroup {
  id: string
  name: string
  members: Mitreisender[]
}

/** Eigene Reisegruppe: verknüpfter Mitreisender, sonst Familie / erste Gruppe am Urlaub */
export function resolveOwnGruppeId(
  userGruppeId: string | null | undefined,
  vacationMitreisende: Mitreisender[]
): string | null {
  if (userGruppeId) return userGruppeId
  if (vacationMitreisende.some((m) => m.gruppe_id === 'grp-familie')) return 'grp-familie'
  return vacationMitreisende.find((m) => m.gruppe_id)?.gruppe_id ?? null
}

export function buildPackProfileGroups(
  vacationMitreisende: Mitreisender[],
  ownGruppeId: string | null
): { ownGroup: Mitreisender[]; otherGroups: PackProfileGroup[] } {
  const byGroup = new Map<string, { name: string; members: Mitreisender[] }>()
  for (const m of vacationMitreisende) {
    const gid = m.gruppe_id ?? 'unknown'
    const gname = m.gruppe_name ?? 'Ohne Gruppe'
    if (!byGroup.has(gid)) {
      byGroup.set(gid, { name: gname, members: [] })
    }
    byGroup.get(gid)!.members.push(m)
  }

  const ownKey = ownGruppeId ?? 'unknown'
  const ownEntry = byGroup.get(ownKey)
  const ownGroup = sortMitreisendeNachRolleUndName(ownEntry?.members ?? [])

  const otherGroups: PackProfileGroup[] = []
  for (const [id, g] of byGroup) {
    if (id === ownKey) continue
    otherGroups.push({
      id,
      name: g.name,
      members: sortMitreisendeNachRolleUndName(g.members),
    })
  }
  otherGroups.sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return { ownGroup, otherGroups }
}

/** Alle Mitreisenden nach Reisegruppe (z. B. Urlaubs-Detailseite) */
export function groupAllMitreisendeByGruppe(
  mitreisende: Mitreisender[]
): PackProfileGroup[] {
  const byGroup = new Map<string, { name: string; members: Mitreisender[] }>()
  for (const m of mitreisende) {
    const gid = m.gruppe_id ?? 'unknown'
    const gname = m.gruppe_name ?? 'Ohne Gruppe'
    if (!byGroup.has(gid)) {
      byGroup.set(gid, { name: gname, members: [] })
    }
    byGroup.get(gid)!.members.push(m)
  }

  const groups: PackProfileGroup[] = []
  for (const [id, g] of byGroup) {
    groups.push({
      id,
      name: g.name,
      members: sortMitreisendeNachRolleUndName(g.members),
    })
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return groups
}

/** Mitreisende, die im Modus „Zentral / Alle“ einbezogen werden */
export function getPackProfileScopeMitreisende(
  vacationMitreisende: Mitreisender[],
  options: {
    canSelectOtherProfiles: boolean
    isAdmin: boolean
    ownGruppeId: string | null
    ownMitreisenderId: string | null
  }
): Mitreisender[] {
  const { canSelectOtherProfiles, isAdmin, ownGruppeId, ownMitreisenderId } = options
  if (!canSelectOtherProfiles) {
    return ownMitreisenderId
      ? vacationMitreisende.filter((m) => m.id === ownMitreisenderId)
      : []
  }
  if (isAdmin) return vacationMitreisende
  if (ownGruppeId) {
    return vacationMitreisende.filter((m) => m.gruppe_id === ownGruppeId)
  }
  return ownMitreisenderId
    ? vacationMitreisende.filter((m) => m.id === ownMitreisenderId)
    : []
}

export function packProfileScopeIdSet(mitreisende: Mitreisender[]): Set<string> {
  return new Set(mitreisende.map((m) => m.id))
}
