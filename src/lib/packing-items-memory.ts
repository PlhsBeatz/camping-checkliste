import type { PackingItem } from './db'
import { getCachedPackingItems } from './offline-sync'

/** Kurzzeit-Speicher pro Urlaub – überlebt React-Remount (Strict Mode) ohne leere Packliste. */
const itemsByVacation = new Map<string, PackingItem[]>()

/**
 * Synchroner Persistenz-Layer (localStorage). Der Memory-Cache (Map) ist nach einem
 * vollständigen App-Neustart leer – z. B. wenn Android die im Hintergrund liegende PWA
 * verwirft und beim Zurückkehren neu startet. IndexedDB wäre verfügbar, ist aber asynchron
 * und führt zu einem kurzen leeren „Lädt…"-Moment. localStorage ist synchron und erlaubt
 * daher beim allerersten Render sofort die letzte Liste – kein sichtbarer Neuaufbau.
 *
 * Leere Listen werden explizit gelöscht (Map + localStorage), damit das Löschen des
 * letzten Eintrags nach Reload nicht durch stale Cache wiederbelebt wird.
 */
const LS_PREFIX = 'packlist:items:'
const LS_INDEX_KEY = 'packlist:items:__index__'
const LS_MAX_VACATIONS = 8

function lsAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function readIndex(): string[] {
  if (!lsAvailable()) return []
  try {
    const raw = window.localStorage.getItem(LS_INDEX_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

/** vacationId an den Anfang stellen (zuletzt genutzt) und auf LS_MAX_VACATIONS begrenzen. */
function touchIndex(vacationId: string): void {
  if (!lsAvailable()) return
  try {
    const next = [vacationId, ...readIndex().filter((id) => id !== vacationId)]
    const overflow = next.slice(LS_MAX_VACATIONS)
    for (const id of overflow) {
      window.localStorage.removeItem(LS_PREFIX + id)
    }
    window.localStorage.setItem(
      LS_INDEX_KEY,
      JSON.stringify(next.slice(0, LS_MAX_VACATIONS))
    )
  } catch {
    // localStorage kann voll/deaktiviert sein – dann arbeiten wir nur mit Memory + IndexedDB.
  }
}

function removeFromIndex(vacationId: string): void {
  if (!lsAvailable()) return
  try {
    const next = readIndex().filter((id) => id !== vacationId)
    window.localStorage.setItem(LS_INDEX_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function readFromLocalStorage(vacationId: string): PackingItem[] | undefined {
  if (!lsAvailable()) return undefined
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + vacationId)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as PackingItem[]
    }
  } catch {
    // Beschädigter Eintrag – ignorieren.
  }
  return undefined
}

function writeToLocalStorage(vacationId: string, items: PackingItem[]): void {
  if (!lsAvailable() || items.length === 0) return
  try {
    window.localStorage.setItem(LS_PREFIX + vacationId, JSON.stringify(items))
    touchIndex(vacationId)
  } catch {
    // Quota überschritten o. Ä. – nicht kritisch, Memory/IndexedDB bleiben Quelle.
  }
}

function clearFromLocalStorage(vacationId: string): void {
  if (!lsAvailable()) return
  try {
    window.localStorage.removeItem(LS_PREFIX + vacationId)
    removeFromIndex(vacationId)
  } catch {
    // ignore
  }
}

export function getPackingItemsMemory(vacationId: string): PackingItem[] | undefined {
  const mem = itemsByVacation.get(vacationId)
  if (mem && mem.length > 0) return mem
  // Memory leer (z. B. Kaltstart nach OS-Neustart): synchron aus localStorage holen.
  const persisted = readFromLocalStorage(vacationId)
  if (persisted) {
    itemsByVacation.set(vacationId, persisted)
    return persisted
  }
  // Explizit geleerte Liste (letzter Eintrag gelöscht): nicht aus LS wiederbeleben.
  if (mem && mem.length === 0) return mem
  return undefined
}

export function setPackingItemsMemory(
  vacationId: string,
  items: PackingItem[]
): void {
  if (items.length > 0) {
    itemsByVacation.set(vacationId, items)
    writeToLocalStorage(vacationId, items)
    return
  }
  // Leere Liste: stale Cache entfernen, aber leeres Array merken (Remount/Reload-Schutz).
  itemsByVacation.set(vacationId, [])
  clearFromLocalStorage(vacationId)
}

/** Memory zuerst, dann IndexedDB – für Offline ohne Netzwerk-Request. */
export async function loadLocalPackingItems(
  vacationId: string
): Promise<PackingItem[] | null> {
  const mem = getPackingItemsMemory(vacationId)
  if (mem && mem.length > 0) return mem
  // Explizit leer gehalten – nicht IndexedDB-Stale als Wahrheit nehmen.
  if (mem && mem.length === 0) return []
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
  setPackingItemsMemory(vacationId, items)
}
