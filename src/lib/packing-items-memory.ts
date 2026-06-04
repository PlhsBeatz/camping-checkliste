import type { PackingItem } from './db'

/** Kurzzeit-Speicher pro Urlaub – überlebt React-Remount (Strict Mode) ohne leere Packliste. */
const itemsByVacation = new Map<string, PackingItem[]>()

export function getPackingItemsMemory(vacationId: string): PackingItem[] | undefined {
  return itemsByVacation.get(vacationId)
}

export function setPackingItemsMemory(
  vacationId: string,
  items: PackingItem[]
): void {
  itemsByVacation.set(vacationId, items)
}
