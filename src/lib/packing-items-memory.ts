import type { PackingItem } from './db'
import { getCachedPackingItems } from './offline-sync'

/** Kurzzeit-Speicher pro Urlaub – überlebt React-Remount (Strict Mode) ohne leere Packliste. */
const itemsByVacation = new Map<string, PackingItem[]>()

export function getPackingItemsMemory(vacationId: string): PackingItem[] | undefined {
  return itemsByVacation.get(vacationId)
}

export function setPackingItemsMemory(
  vacationId: string,
  items: PackingItem[]
): void {
  if (items.length > 0) {
    itemsByVacation.set(vacationId, items)
  }
}

/** Memory zuerst, dann IndexedDB – für Offline ohne Netzwerk-Request. */
export async function loadLocalPackingItems(
  vacationId: string
): Promise<PackingItem[] | null> {
  const mem = getPackingItemsMemory(vacationId)
  if (mem && mem.length > 0) return mem
  const cached = await getCachedPackingItems(vacationId)
  if (cached.length > 0) {
    setPackingItemsMemory(vacationId, cached)
    return cached
  }
  return null
}

/** Aktuellen UI-Stand sofort in Memory legen (vor async IndexedDB beim Offline-Wechsel). */
export function snapshotPackingItemsToMemory(
  vacationId: string,
  items: PackingItem[]
): void {
  if (items.length > 0) {
    setPackingItemsMemory(vacationId, items)
  }
}
