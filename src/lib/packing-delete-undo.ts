import type { PackingItem, PackingItemMitreisender } from '@/lib/db'
import { applyBulkDeleteToItem } from '@/lib/bulk-packing-profile'

export type ShowPackListUndoToast = (opts: {
  message?: string
  itemName?: string
  action: () => void
}) => void

export function truncateForDeleteUndoToast(text: string, maxLen = 72): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

export function clonePackingItemSnapshot(item: PackingItem): PackingItem {
  return structuredClone(item)
}

export function formatDeleteUndoMessage(itemName: string): string {
  return `„${truncateForDeleteUndoToast(itemName)}" von der Packliste entfernt`
}

export function formatBulkDeleteUndoMessage(count: number): string {
  return count === 1
    ? '1 Eintrag von der Packliste entfernt'
    : `${count} Einträge von der Packliste entfernt`
}

export function buildPackingItemRestorePayload(item: PackingItem) {
  return {
    id: item.id,
    is_temporaer: item.is_temporaer,
    gegenstand_id: item.gegenstand_id,
    was: item.was,
    kategorie_id: item.kategorie_id,
    anzahl: item.anzahl,
    gepackt: item.gepackt,
    gepackt_vorgemerkt: item.gepackt_vorgemerkt,
    gepackt_vorgemerkt_durch: item.gepackt_vorgemerkt_durch ?? null,
    bemerkung: item.bemerkung ?? null,
    transport_id: item.transport_id ?? null,
    einzelgewicht: item.einzelgewicht,
    einzelgewicht_override: item.einzelgewicht_override ?? null,
    pauschal_gruppen_modus: item.pauschal_gruppen_modus ?? 'einmal',
    verantwortliche_gruppe_id: item.verantwortliche_gruppe_id ?? null,
    mitreisende: item.mitreisende ?? [],
    gruppen: item.gruppen ?? [],
  }
}

/** @deprecated Nutze buildPackingItemRestorePayload – POST /api/packing-items/restore */
export function buildPackingItemRecreateBody(item: PackingItem, vacationId: string) {
  if (item.is_temporaer) {
    return {
      vacationId,
      temporary: true,
      was: item.was,
      kategorieId: item.kategorie_id,
      anzahl: item.anzahl,
      bemerkung: item.bemerkung ?? null,
      transportId: item.transport_id ?? null,
      mitreisende: (item.mitreisende ?? []).map((m) => m.mitreisender_id),
      pauschalGruppenModus: item.pauschal_gruppen_modus ?? 'einmal',
    }
  }

  return {
    vacationId,
    gegenstandId: item.gegenstand_id,
    anzahl: item.anzahl,
    bemerkung: item.bemerkung ?? null,
    transportId: item.transport_id ?? null,
    mitreisende: (item.mitreisende ?? []).map((m) =>
      m.anzahl != null ? { id: m.mitreisender_id, anzahl: m.anzahl } : m.mitreisender_id
    ),
    pauschalGruppenModus: item.pauschal_gruppen_modus ?? 'einmal',
  }
}

export function mergeMitreisendeBack(
  item: PackingItem,
  removedRows: PackingItemMitreisender[]
): PackingItem {
  const existingIds = new Set((item.mitreisende ?? []).map((m) => m.mitreisender_id))
  const toAdd = removedRows.filter((m) => !existingIds.has(m.mitreisender_id))
  return { ...item, mitreisende: [...(item.mitreisende ?? []), ...toAdd] }
}

export function applyPersonDeleteToSnapshot(
  snapshot: PackingItem,
  personIds: string[]
): { afterDelete: PackingItem | null; removedRows: PackingItemMitreisender[] } {
  const idSet = new Set(personIds)
  const removedRows = (snapshot.mitreisende ?? []).filter((m) => idSet.has(m.mitreisender_id))
  const afterDelete = applyBulkDeleteToItem(snapshot, personIds)
  return { afterDelete, removedRows }
}

export function restoreItemsInList(
  current: PackingItem[],
  restoredItems: PackingItem[]
): PackingItem[] {
  const restoreById = new Map(restoredItems.map((item) => [item.id, item]))
  const without = current.filter((item) => !restoreById.has(item.id))
  return [...without, ...restoredItems]
}
