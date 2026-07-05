import type { PackingItem, Mitreisender } from '@/lib/db'
import { sortMitreisendenZeilenNachStammdaten } from '@/lib/mitreisenden-sort'

export type BulkScopeTraveler = {
  id: string
  name: string
  gepackt?: boolean
  gepackt_vorgemerkt?: boolean
}

/** Übersicht + personenbezogene Einträge → Personen zuerst wählen. */
export function needsBulkPersonSelection(
  selectedItems: PackingItem[],
  selectedProfile: string | null
): boolean {
  if (selectedProfile) return false
  return selectedItems.some(
    (item) =>
      item.mitreisenden_typ !== 'pauschal' &&
      (item.mitreisende?.length ?? 0) > 0
  )
}

/** Betroffene Personen (eigene Gruppe) über alle ausgewählten Einträge. */
export function collectBulkScopeTravelers(
  selectedItems: PackingItem[],
  scopeIds: Set<string>,
  vacationMitreisende: Mitreisender[]
): BulkScopeTraveler[] {
  const byId = new Map<string, BulkScopeTraveler>()

  for (const item of selectedItems) {
    if (item.mitreisenden_typ === 'pauschal') continue
    for (const row of item.mitreisende ?? []) {
      if (!scopeIds.has(row.mitreisender_id)) continue
      const existing = byId.get(row.mitreisender_id)
      if (!existing) {
        byId.set(row.mitreisender_id, {
          id: row.mitreisender_id,
          name: row.mitreisender_name,
          gepackt: !!row.gepackt,
          gepackt_vorgemerkt: !!row.gepackt_vorgemerkt,
        })
      } else {
        if (row.gepackt) existing.gepackt = true
        if (row.gepackt_vorgemerkt) existing.gepackt_vorgemerkt = true
      }
    }
  }

  return sortMitreisendenZeilenNachStammdaten([...byId.values()], vacationMitreisende)
}

export type BulkDeleteSemantics = 'whole' | 'person' | 'mixed'

export type BulkEditBemerkungMode = 'hidden' | 'mixed' | 'normal'

function classifyBulkItemTargets(
  selectedItems: PackingItem[],
  selectedProfile: string | null,
  scopeIds: Set<string>,
  selectedPersonIds?: string[] | null
): { hasWholeItems: boolean; hasPersonItems: boolean } {
  const personIdSet = selectedPersonIds?.length ? new Set(selectedPersonIds) : null
  let hasWholeItems = false
  let hasPersonItems = false

  for (const item of selectedItems) {
    const personIds = resolveBulkPersonMitreisenderIds(
      item,
      selectedProfile,
      scopeIds,
      personIdSet
    )
    if (personIds) hasPersonItems = true
    else hasWholeItems = true
  }

  return { hasWholeItems, hasPersonItems }
}

export function getBulkEditBemerkungMode(
  selectedItems: PackingItem[],
  selectedProfile: string | null,
  scopeIds: Set<string>,
  selectedPersonIds?: string[] | null
): BulkEditBemerkungMode {
  const { hasWholeItems, hasPersonItems } = classifyBulkItemTargets(
    selectedItems,
    selectedProfile,
    scopeIds,
    selectedPersonIds
  )
  if (hasPersonItems && !hasWholeItems) return 'hidden'
  if (hasPersonItems && hasWholeItems) return 'mixed'
  return 'normal'
}

export function classifyBulkDeleteSemantics(
  selectedItems: PackingItem[],
  selectedProfile: string | null,
  scopeIds: Set<string>,
  selectedPersonIds?: string[] | null
): BulkDeleteSemantics {
  const { hasWholeItems, hasPersonItems } = classifyBulkItemTargets(
    selectedItems,
    selectedProfile,
    scopeIds,
    selectedPersonIds
  )
  if (hasWholeItems && hasPersonItems) return 'mixed'
  if (hasPersonItems) return 'person'
  return 'whole'
}

/**
 * Mitreisende, deren Zeile bei Bulk-Aktionen betroffen ist.
 * null = ganzer Packlisteneintrag (nicht personenbezogen im aktuellen Kontext).
 */
export function resolveBulkPersonMitreisenderIds(
  item: PackingItem,
  selectedProfile: string | null,
  scopeIds: Set<string>,
  selectedPersonIds?: Set<string> | null
): string[] | null {
  if (item.mitreisenden_typ === 'pauschal') return null

  const rows = item.mitreisende ?? []

  if (selectedProfile) {
    if (rows.some((m) => m.mitreisender_id === selectedProfile)) {
      return [selectedProfile]
    }
    return null
  }

  if (rows.length === 0) return null

  let scoped = rows
    .filter((m) => scopeIds.has(m.mitreisender_id))
    .map((m) => m.mitreisender_id)

  if (selectedPersonIds) {
    scoped = scoped.filter((id) => selectedPersonIds.has(id))
  }

  return scoped.length > 0 ? scoped : null
}

export type BulkEditFieldDefaults = {
  anzahl?: number
  transport_id?: string | null
  bemerkung?: string | null
}

function allSame<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined
  const first = values[0]
  return values.every((v) => v === first) ? first : undefined
}

/** Gemeinsame Feldwerte, wenn alle betroffenen Zeilen übereinstimmen. */
export function computeBulkEditFieldDefaults(
  selectedItems: PackingItem[],
  selectedProfile: string | null,
  scopeIds: Set<string>,
  selectedPersonIds?: string[] | null
): BulkEditFieldDefaults {
  const personIdSet = selectedPersonIds?.length ? new Set(selectedPersonIds) : null
  const anzahlValues: number[] = []
  const transportValues: (string | null)[] = []
  const bemerkungValues: (string | null)[] = []

  for (const item of selectedItems) {
    const personIds = resolveBulkPersonMitreisenderIds(
      item,
      selectedProfile,
      scopeIds,
      personIdSet
    )
    if (personIds) {
      for (const personId of personIds) {
        const row = item.mitreisende?.find((m) => m.mitreisender_id === personId)
        anzahlValues.push(row?.anzahl ?? item.anzahl)
        transportValues.push(row?.transport_id ?? item.transport_id ?? null)
      }
    } else {
      anzahlValues.push(item.anzahl)
      transportValues.push(item.transport_id ?? null)
      const remark = item.bemerkung?.trim()
      bemerkungValues.push(remark ? remark : null)
    }
  }

  const defaults: BulkEditFieldDefaults = {}
  const commonAnzahl = allSame(anzahlValues)
  if (commonAnzahl !== undefined) defaults.anzahl = commonAnzahl
  const commonTransport = allSame(transportValues)
  if (commonTransport !== undefined) defaults.transport_id = commonTransport
  const commonBemerkung = allSame(bemerkungValues)
  if (commonBemerkung !== undefined) defaults.bemerkung = commonBemerkung

  return defaults
}

export function applyBulkPatchToItem(
  item: PackingItem,
  patch: { transport_id?: string | null; bemerkung?: string | null; anzahl?: number },
  transportNameById: Map<string, string>,
  personIds: string[] | null
): PackingItem {
  if (personIds && personIds.length > 0) {
    const idSet = new Set(personIds)
    return {
      ...item,
      mitreisende: item.mitreisende?.map((m) => {
        if (!idSet.has(m.mitreisender_id)) return m
        const next = { ...m }
        if ('anzahl' in patch && patch.anzahl !== undefined) {
          next.anzahl = patch.anzahl
        }
        if ('transport_id' in patch) {
          next.transport_id = patch.transport_id ?? null
          next.transport_name = patch.transport_id
            ? transportNameById.get(patch.transport_id) ?? undefined
            : undefined
        }
        return next
      }),
    }
  }

  const next = { ...item }
  if ('transport_id' in patch) {
    next.transport_id = patch.transport_id ?? null
    next.transport_name = patch.transport_id
      ? transportNameById.get(patch.transport_id) ?? undefined
      : undefined
  }
  if ('bemerkung' in patch) next.bemerkung = patch.bemerkung ?? null
  if ('anzahl' in patch && patch.anzahl !== undefined) next.anzahl = patch.anzahl
  return next
}

export function applyBulkDeleteToItem(
  item: PackingItem,
  personIds: string[] | null
): PackingItem | null {
  if (!personIds || personIds.length === 0) return null

  const idSet = new Set(personIds)
  const remaining = (item.mitreisende ?? []).filter((m) => !idSet.has(m.mitreisender_id))
  return { ...item, mitreisende: remaining }
}
