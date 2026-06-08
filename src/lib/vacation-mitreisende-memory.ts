import type { Mitreisender } from './db'
import { getCachedVacationMitreisende } from './offline-sync'

/** Kurzzeit-Speicher pro Urlaub – Packprofile sofort anzeigen (ohne Netzwerk-Wartezeit). */
const byVacation = new Map<string, Mitreisender[]>()

const LS_PREFIX = 'packlist:mitreisende:'
const LS_INDEX_KEY = 'packlist:mitreisende:__index__'
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
    /* ignore */
  }
}

function readFromLocalStorage(vacationId: string): Mitreisender[] | undefined {
  if (!lsAvailable()) return undefined
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + vacationId)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as Mitreisender[]
    }
  } catch {
    /* ignore */
  }
  return undefined
}

function writeToLocalStorage(vacationId: string, items: Mitreisender[]): void {
  if (!lsAvailable() || items.length === 0) return
  try {
    window.localStorage.setItem(LS_PREFIX + vacationId, JSON.stringify(items))
    touchIndex(vacationId)
  } catch {
    /* ignore */
  }
}

export function getVacationMitreisendeMemory(
  vacationId: string
): Mitreisender[] | undefined {
  const mem = byVacation.get(vacationId)
  if (mem && mem.length > 0) return mem
  const persisted = readFromLocalStorage(vacationId)
  if (persisted) {
    byVacation.set(vacationId, persisted)
    return persisted
  }
  return mem
}

export function setVacationMitreisendeMemory(
  vacationId: string,
  items: Mitreisender[]
): void {
  if (items.length > 0) {
    byVacation.set(vacationId, items)
    writeToLocalStorage(vacationId, items)
  }
}

/** Memory zuerst, dann IndexedDB – für sofortige Packprofil-Anzeige. */
export async function loadLocalVacationMitreisende(
  vacationId: string
): Promise<Mitreisender[] | null> {
  const mem = getVacationMitreisendeMemory(vacationId)
  if (mem && mem.length > 0) return mem
  const cached = await getCachedVacationMitreisende(vacationId)
  if (cached.length > 0) {
    setVacationMitreisendeMemory(vacationId, cached)
    return cached
  }
  return null
}
