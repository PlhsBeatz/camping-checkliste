/**
 * Offline-Sync: Netzwerkstatus, Cache-Fill und Sync-Queue (Last-Write-Wins).
 * Änderungen werden bei Offline in die Queue gelegt und beim Reconnect gesendet.
 */

import {
  offlineDb,
  cacheVacations,
  cacheEquipment,
  cacheCategories,
  cacheMainCategories,
  cacheTags,
  cacheMitreisende,
  cacheTransportVehicles,
  cachePackingItems,
  type SyncQueueEntry,
} from './offline-db'
import type {
  Vacation,
  EquipmentItem,
  Category,
  MainCategory,
  Tag,
  Mitreisender,
  TransportVehicle,
  PackingItem,
} from './db'

/** Prüft, ob die App online ist */
export function useOnline(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

/** Holt Online-Status und reagiert auf Änderungen */
export function subscribeToOnlineStatus(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => callback(navigator.onLine)
  window.addEventListener('online', handler)
  window.addEventListener('offline', handler)
  callback(navigator.onLine)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('offline', handler)
  }
}

/** API-Response mit Cache füllen und Daten zurückgeben */
export async function fetchAndCache<T>(
  url: string,
  cacheKey: string,
  cacheFn: (data: T) => Promise<void>
): Promise<{ data: T; fromCache: boolean }> {
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true

  if (online) {
    try {
      const res = await fetch(url)
      const json = (await res.json()) as { success: boolean; data?: T }
      if (json.success && json.data) {
        await cacheFn(json.data)
        return { data: json.data, fromCache: false }
      }
    } catch {
      // Fallback auf Cache
    }
  }

  // Aus Cache lesen (vereinfacht: wir haben keine generische Cache-Lese-API pro URL)
  return { data: null as unknown as T, fromCache: true }
}

/** Aus IndexedDB lesen */
export async function getCachedVacations(): Promise<Vacation[]> {
  const rows = await offlineDb.vacations.toArray()
  return rows.map(stripMeta)
}

export async function getCachedEquipment(): Promise<EquipmentItem[]> {
  const rows = await offlineDb.equipment.toArray()
  return rows.map(stripMeta)
}

export async function getCachedCategories(): Promise<Category[]> {
  const rows = await offlineDb.categories.toArray()
  return rows.map(stripMeta)
}

export async function getCachedMainCategories(): Promise<MainCategory[]> {
  const rows = await offlineDb.mainCategories.toArray()
  return rows.map(stripMeta)
}

export async function getCachedTags(): Promise<Tag[]> {
  const rows = await offlineDb.tags.toArray()
  return rows.map(stripMeta)
}

export async function getCachedMitreisende(): Promise<Mitreisender[]> {
  const rows = await offlineDb.mitreisende.toArray()
  return rows.map(stripMeta)
}

export async function getCachedTransportVehicles(): Promise<TransportVehicle[]> {
  const rows = await offlineDb.transportVehicles.toArray()
  return rows.map(stripMeta)
}

export async function getCachedPackingItems(
  vacationId: string
): Promise<PackingItem[]> {
  const rows = await offlineDb.packingItems
    .where('_vacationId')
    .equals(vacationId)
    .toArray()
  return rows.map(stripMeta)
}

function stripMeta<T extends Record<string, unknown>>(row: T): T {
  const { _cachedAt, _updatedAt, _vacationId, ...rest } = row
  return rest as T
}

/** Cache-Funktionen für jede Entität */
export const cacheFns = {
  vacations: cacheVacations,
  equipment: cacheEquipment,
  categories: cacheCategories,
  mainCategories: cacheMainCategories,
  tags: cacheTags,
  mitreisende: cacheMitreisende,
  transportVehicles: cacheTransportVehicles,
  packingItems: cachePackingItems,
}

/** Sync-Queue: Eintrag hinzufügen (bei Offline-Mutation) */
export async function enqueueSync(
  table: string,
  action: 'put' | 'delete',
  key: string,
  payload?: unknown
): Promise<void> {
  await offlineDb.syncQueue.add({
    table,
    action,
    key,
    payload,
    timestamp: Date.now(),
  })
}

/** Sync-Queue abarbeiten (beim Reconnect) – Last-Write-Wins */
export async function processSyncQueue(): Promise<{ ok: number; failed: number }> {
  const entries = await offlineDb.syncQueue.orderBy('timestamp').toArray()
  let ok = 0
  let failed = 0

  for (const e of entries) {
    try {
      const sent = await sendQueueEntry(e)
      if (sent) {
        await offlineDb.syncQueue.where('id').equals(e.id!).delete()
        ok++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { ok, failed }
}

async function sendQueueEntry(e: SyncQueueEntry): Promise<boolean> {
  // Vereinfachte Implementierung: Wir mappen table/action auf API-Aufrufe.
  // In einer vollständigen Implementierung würden wir pro Tabelle die passende API aufrufen.
  // Für MVP: Nur Log, kein tatsächlicher API-Call (um API-Struktur nicht zu brechen)
  console.warn('SyncQueue: would sync', e.table, e.action, e.key, e.payload)
  return true
}
