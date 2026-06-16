import type { Mitreisender, PackingItem, PackingItemGruppe } from '@/lib/db'

export type PauschalGruppenModus = 'offen' | 'einmal' | 'pro_gruppe' | 'ausgewaehlte_gruppen'

export type PauschalGruppenFilter = 'alle' | 'eigene' | 'offen'

export function getVacationGruppeIds(mitreisende: Mitreisender[]): string[] {
  const ids = new Set<string>()
  for (const m of mitreisende) {
    if (m.gruppe_id) ids.add(m.gruppe_id)
  }
  return [...ids]
}

export function hasMultipleVacationGroups(mitreisende: Mitreisender[]): boolean {
  return getVacationGruppeIds(mitreisende).length > 1
}

export function getVacationGruppenMap(
  mitreisende: Mitreisender[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const m of mitreisende) {
    if (m.gruppe_id && m.gruppe_name) {
      map.set(m.gruppe_id, m.gruppe_name)
    }
  }
  return map
}

/** Aktueller Gruppenname aus Urlaubsdaten – gespeicherte Namen am Eintrag können veraltet sein. */
export function resolveGruppeName(
  gruppeId: string,
  gruppenMap: Map<string, string>,
  storedName?: string | null
): string {
  const fromMap = gruppenMap.get(gruppeId)?.trim()
  if (fromMap) return fromMap
  const stored = storedName?.trim()
  if (stored) return stored
  return '?'
}

export function isPauschalGruppenFeatureActive(
  item: Pick<PackingItem, 'mitreisenden_typ'>,
  vacationMitreisende: Mitreisender[]
): boolean {
  return item.mitreisenden_typ === 'pauschal' && hasMultipleVacationGroups(vacationMitreisende)
}

export function isPauschalGruppeUnassigned(item: PackingItem): boolean {
  return (item.pauschal_gruppen_modus ?? 'einmal') === 'offen'
}

export type PauschalBadgeVariant = 'offen' | 'gemeinsam' | 'gruppe' | 'mehrere' | 'alle_haushalte'

export interface PauschalBadgeInfo {
  label: string
  variant: PauschalBadgeVariant
  gruppeId?: string | null
}

export function getPauschalBadgeLabel(
  item: PackingItem,
  gruppenMap: Map<string, string>
): { label: string; variant: PauschalBadgeVariant } {
  return getPauschalBadgeLabels(item, gruppenMap)[0]!
}

/** Ein oder mehrere Badges – bei expandAllGroups je zugeordnete Gruppe ein Badge */
export function getPauschalBadgeLabels(
  item: PackingItem,
  gruppenMap: Map<string, string>,
  options?: { expandAllGroups?: boolean; ownGruppeId?: string | null }
): PauschalBadgeInfo[] {
  const modus = item.pauschal_gruppen_modus ?? 'einmal'

  if (modus === 'offen') {
    return [{ label: 'Nicht zugeordnet', variant: 'offen' }]
  }

  if (
    options?.expandAllGroups &&
    (modus === 'pro_gruppe' || modus === 'ausgewaehlte_gruppen')
  ) {
    const gruppen = item.gruppen ?? []
    if (gruppen.length === 0) return [{ label: 'Nicht zugeordnet', variant: 'offen' }]
    return gruppen.map((g) => ({
      label: resolveGruppeName(g.gruppe_id, gruppenMap, g.gruppe_name),
      variant: 'gruppe' as const,
      gruppeId: g.gruppe_id,
    }))
  }

  if (modus === 'pro_gruppe') {
    return [{ label: 'Alle Haushalte', variant: 'alle_haushalte' }]
  }
  if (modus === 'ausgewaehlte_gruppen') {
    const gruppen = item.gruppen ?? []
    const names = gruppen.map((g) => resolveGruppeName(g.gruppe_id, gruppenMap, g.gruppe_name))
    if (names.length === 0) return [{ label: 'Nicht zugeordnet', variant: 'offen' }]
    if (names.length === 1) {
      const gid = gruppen[0]?.gruppe_id ?? null
      return [{ label: names[0]!, variant: 'gruppe', gruppeId: gid }]
    }
    const ownGruppeId = options?.ownGruppeId
    const ownEntry = ownGruppeId ? gruppen.find((g) => g.gruppe_id === ownGruppeId) : undefined
    if (ownEntry) {
      const ownName = resolveGruppeName(ownEntry.gruppe_id, gruppenMap, ownEntry.gruppe_name)
      const others = gruppen.length - 1
      return [
        {
          label: others > 0 ? `${ownName} +${others}` : ownName,
          variant: 'mehrere',
          gruppeId: ownEntry.gruppe_id,
        },
      ]
    }
    return [{ label: `${names[0]!} +${names.length - 1}`, variant: 'mehrere' }]
  }
  if (item.verantwortliche_gruppe_id) {
    const name = resolveGruppeName(
      item.verantwortliche_gruppe_id,
      gruppenMap,
      item.verantwortliche_gruppe_name
    )
    return [{ label: name, variant: 'gruppe', gruppeId: item.verantwortliche_gruppe_id }]
  }
  return [{ label: 'Gemeinsam', variant: 'gemeinsam' }]
}

/** Welche Gruppe(n) „besitzen“ diesen pauschalen Eintrag für Berechtigungen/Warnung */
export function getAssignedGruppeIds(item: PackingItem): string[] {
  const modus = item.pauschal_gruppen_modus ?? 'einmal'
  if (modus === 'offen') return []
  if (modus === 'einmal') {
    return item.verantwortliche_gruppe_id ? [item.verantwortliche_gruppe_id] : []
  }
  return (item.gruppen ?? []).map((g) => g.gruppe_id)
}

export function canTogglePauschalForOwnGruppe(
  item: PackingItem,
  ownGruppeId: string | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true
  const modus = item.pauschal_gruppen_modus ?? 'einmal'
  if (modus === 'offen' || modus === 'einmal') {
    if (!item.verantwortliche_gruppe_id) return true
    return ownGruppeId === item.verantwortliche_gruppe_id
  }
  return false
}

export function canToggleGruppeCheckbox(
  gruppeId: string,
  ownGruppeId: string | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true
  return ownGruppeId === gruppeId
}

/** Gruppe für Pauschal-Abhaken: gewähltes Personenprofil, sonst eigene Gruppe */
export function resolveActiveGruppeIdForPacking(
  selectedProfileId: string | null,
  vacationMitreisende: Mitreisender[],
  ownGruppeId: string | null
): string | null {
  if (selectedProfileId) {
    const person = vacationMitreisende.find((m) => m.id === selectedProfileId)
    if (person?.gruppe_id) return person.gruppe_id
  }
  return ownGruppeId
}

export function shouldWarnAdminForeignGruppe(
  item: PackingItem,
  ownGruppeId: string | null,
  isAdmin: boolean,
  togglingGruppeId?: string
): boolean {
  if (!isAdmin) return false
  const modus = item.pauschal_gruppen_modus ?? 'einmal'
  if (modus === 'offen') return false
  if (modus === 'einmal') {
    if (!item.verantwortliche_gruppe_id) return false
    if (!ownGruppeId) return true
    return item.verantwortliche_gruppe_id !== ownGruppeId
  }
  const targetId = togglingGruppeId ?? null
  if (!targetId) return false
  if (!ownGruppeId) return true
  return targetId !== ownGruppeId
}

export function getForeignGruppeNameForWarning(
  item: PackingItem,
  gruppenMap: Map<string, string>,
  togglingGruppeId?: string
): string {
  if (togglingGruppeId) {
    return gruppenMap.get(togglingGruppeId) ?? 'einer anderen Gruppe'
  }
  if (item.verantwortliche_gruppe_id) {
    return (
      resolveGruppeName(
        item.verantwortliche_gruppe_id,
        gruppenMap,
        item.verantwortliche_gruppe_name
      ) || 'einer anderen Gruppe'
    )
  }
  return 'einer anderen Gruppe'
}

export function passesPauschalGruppenFilter(
  item: PackingItem,
  filter: PauschalGruppenFilter,
  ownGruppeId: string | null
): boolean {
  if (item.mitreisenden_typ !== 'pauschal') {
    return filter !== 'offen'
  }
  const modus = item.pauschal_gruppen_modus ?? 'einmal'

  if (filter === 'offen') {
    return modus === 'offen'
  }
  if (filter === 'alle') {
    return true
  }
  // eigene Gruppe
  if (modus === 'offen') return false
  if (modus === 'einmal') {
    if (!item.verantwortliche_gruppe_id) return true
    return !ownGruppeId || item.verantwortliche_gruppe_id === ownGruppeId
  }
  if (!ownGruppeId) return true
  return (item.gruppen ?? []).some((g) => g.gruppe_id === ownGruppeId)
}

export function countUnassignedPauschalItems(items: PackingItem[]): number {
  return items.filter(
    (i) => i.mitreisenden_typ === 'pauschal' && isPauschalGruppeUnassigned(i)
  ).length
}

/** Standard-Filter wenn noch keine gespeicherte Wahl existiert */
export function resolveDefaultPauschalGruppenFilter(items: PackingItem[]): PauschalGruppenFilter {
  return countUnassignedPauschalItems(items) === 0 ? 'eigene' : 'alle'
}

/** Nach Packlisten-Laden: Standard anwenden, manuelles „Nicht zugeordnet“ beibehalten */
export function resolvePauschalGruppenFilterOnHydrate(
  items: PackingItem[],
  saved?: PauschalGruppenFilter
): PauschalGruppenFilter {
  const standard = resolveDefaultPauschalGruppenFilter(items)
  if (saved === 'offen' && countUnassignedPauschalItems(items) > 0) {
    return 'offen'
  }
  return standard
}

/** Aus DB-Zustand → ausgewählte Gruppen-Chips im Dialog */
export function getSelectedGruppeIdsFromAssignment(
  modus: PauschalGruppenModus | undefined,
  verantwortlicheGruppeId: string | null | undefined,
  assignedGruppeIds: string[] | undefined,
  allVacationGruppeIds: string[]
): string[] {
  const m = modus ?? 'einmal'
  if (m === 'offen') return []
  if (m === 'pro_gruppe') return allVacationGruppeIds
  if (m === 'ausgewaehlte_gruppen') return assignedGruppeIds ?? []
  if (m === 'einmal' && verantwortlicheGruppeId) return [verantwortlicheGruppeId]
  return []
}

export interface PauschalGruppenAssignmentPayload {
  pauschalGruppenModus: PauschalGruppenModus
  verantwortlicheGruppeId?: string | null
  gruppeIds?: string[]
}

/**
 * 0 Gruppen → offen | 1 → einmal + Verantwortliche | alle → pro_gruppe | sonst → ausgewaehlte_gruppen
 */
export function snapshotPauschalGruppenAssignment(item: PackingItem): PauschalGruppenAssignmentPayload {
  const modus = item.pauschal_gruppen_modus ?? 'einmal'
  return {
    pauschalGruppenModus: modus,
    verantwortlicheGruppeId: item.verantwortliche_gruppe_id ?? null,
    gruppeIds: (item.gruppen ?? []).map((g) => g.gruppe_id),
  }
}

/** Optimistic-Update eines Packlisteneintrags nach Gruppen-Zuordnung */
export function applyPauschalGruppenPayloadToItem(
  item: PackingItem,
  payload: PauschalGruppenAssignmentPayload,
  gruppenMap: Map<string, string>
): PackingItem {
  const packingItemId = item.id
  let gruppen = item.gruppen ?? []
  if (payload.pauschalGruppenModus === 'pro_gruppe') {
    gruppen = [...gruppenMap.keys()].map((gid) => ({
      id: `${packingItemId}-${gid}`,
      gruppe_id: gid,
      gruppe_name: gruppenMap.get(gid),
      gepackt: gruppen.find((g) => g.gruppe_id === gid)?.gepackt ?? false,
    }))
  } else if (payload.pauschalGruppenModus === 'ausgewaehlte_gruppen') {
    gruppen = (payload.gruppeIds ?? []).map((gid) => ({
      id: `${packingItemId}-${gid}`,
      gruppe_id: gid,
      gruppe_name: gruppenMap.get(gid),
      gepackt: gruppen.find((g) => g.gruppe_id === gid)?.gepackt ?? false,
    }))
  } else {
    gruppen = []
  }
  return {
    ...item,
    pauschal_gruppen_modus: payload.pauschalGruppenModus,
    verantwortliche_gruppe_id: payload.verantwortlicheGruppeId ?? null,
    verantwortliche_gruppe_name: payload.verantwortlicheGruppeId
      ? gruppenMap.get(payload.verantwortlicheGruppeId) ?? null
      : null,
    gruppen,
  }
}

export function derivePauschalAssignmentFromGruppeSelection(
  selectedIds: string[],
  allVacationGruppeIds: string[]
): PauschalGruppenAssignmentPayload {
  if (selectedIds.length === 0) {
    return { pauschalGruppenModus: 'offen' }
  }
  if (selectedIds.length === 1) {
    return {
      pauschalGruppenModus: 'einmal',
      verantwortlicheGruppeId: selectedIds[0],
    }
  }
  if (selectedIds.length >= allVacationGruppeIds.length) {
    return { pauschalGruppenModus: 'pro_gruppe' }
  }
  return {
    pauschalGruppenModus: 'ausgewaehlte_gruppen',
    gruppeIds: selectedIds,
  }
}

export function isGruppeFullyPacked(
  g: PackingItemGruppe,
  canConfirmVorgemerkt: boolean
): boolean {
  if (canConfirmVorgemerkt) return g.gepackt
  return g.gepackt || !!g.gepackt_vorgemerkt
}

export function getOwnGruppePackingState(
  item: PackingItem,
  ownGruppeId: string | null
): PackingItemGruppe | undefined {
  if (!ownGruppeId) return undefined
  return (item.gruppen ?? []).find((g) => g.gruppe_id === ownGruppeId)
}

export function areAllGruppenFullyPacked(
  item: PackingItem,
  canConfirmVorgemerkt: boolean
): boolean {
  const gruppen = item.gruppen ?? []
  if (gruppen.length === 0) return false
  return gruppen.every((g) => isGruppeFullyPacked(g, canConfirmVorgemerkt))
}

export function isPauschalItemFullyPackedForProfile(
  item: PackingItem,
  ownGruppeId: string | null,
  canConfirmVorgemerkt: boolean
): boolean {
  const modus = item.pauschal_gruppen_modus ?? 'einmal'
  if (modus === 'pro_gruppe' || modus === 'ausgewaehlte_gruppen') {
    const gruppen = item.gruppen ?? []
    if (gruppen.length === 0) return false
    if (ownGruppeId) {
      const own = gruppen.find((g) => g.gruppe_id === ownGruppeId)
      if (own) return isGruppeFullyPacked(own, canConfirmVorgemerkt)
    }
    return gruppen.every((g) => isGruppeFullyPacked(g, canConfirmVorgemerkt))
  }
  if (canConfirmVorgemerkt) return item.gepackt
  return item.gepackt || !!item.gepackt_vorgemerkt
}

export const ADMIN_FOREIGN_GRUPPE_WARN_KEY = 'pauschalAdminForeignWarn:'

export function isAdminForeignWarnSuppressed(vacationId: string): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(`${ADMIN_FOREIGN_GRUPPE_WARN_KEY}${vacationId}`) === '1'
}

export function suppressAdminForeignWarn(vacationId: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`${ADMIN_FOREIGN_GRUPPE_WARN_KEY}${vacationId}`, '1')
}
