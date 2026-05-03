/**
 * Offline-Sync: Netzwerkstatus, Cache-Fill, Sync-Queue (Last-Write-Wins) und SWR-Helper.
 * Mutationen, die offline angestoßen werden, landen in der `syncQueue` und werden bei
 * Reconnect über `processSyncQueue` an die jeweilige API geschickt.
 */

import {
  offlineDb,
  cacheVacations,
  cacheEquipment,
  cacheCategories,
  cacheMainCategories,
  cacheTags,
  cacheTagKategorien,
  cacheMitreisende,
  cacheVacationMitreisende,
  cacheTransportVehicles,
  cachePackingItems,
  cacheChecklisten,
  cacheLastPosition,
  cachePackStatus,
  cacheCampingplaetze,
  cacheCampingplatz,
  cacheCampingplatzFotos,
  cacheRoute,
  cacheHomeLocation,
  cacheAuthUser,
  type SyncQueueEntry,
} from './offline-db'
import type {
  Vacation,
  EquipmentItem,
  Category,
  MainCategory,
  Tag,
  TagKategorie,
  Mitreisender,
  TransportVehicle,
  PackingItem,
  ChecklisteMitStruktur,
  Campingplatz,
  CampingplatzFoto,
  CampingplatzRouteCacheEntry,
  PackStatusData,
} from './db'

/** Wie `getPackingItems` in `db.ts` nach dem Merge (Hauptkat → Kategorie → Titel). */
function sortPackingItemsForDisplay(items: PackingItem[]): PackingItem[] {
  return [...items].sort((a, b) => {
    const hkA = a.orderHk ?? 999
    const hkB = b.orderHk ?? 999
    if (hkA !== hkB) return hkA - hkB
    const kA = a.orderK ?? 999
    const kB = b.orderK ?? 999
    if (kA !== kB) return kA - kB
    return a.was.localeCompare(b.was, 'de')
  })
}

// ---------------------------------------------------------------------------
// Netzwerk-Status
// ---------------------------------------------------------------------------

/** Prüft, ob die App online ist (synchron, basierend auf navigator.onLine) */
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

// ---------------------------------------------------------------------------
// Generischer SWR-Helper
// ---------------------------------------------------------------------------

/**
 * Stale-While-Revalidate-Pattern für API-Lesepfade:
 * 1. Versucht im Netzwerk zu laden.
 * 2. Bei Erfolg: Antwort cachen und zurückgeben (`fromCache: false`).
 * 3. Bei Fehler/Offline: aus IndexedDB lesen (`fromCache: true`).
 *
 * `cacheRead` ist optional. Ohne sie verhält sich die Funktion wie ein reines
 * "Network-with-cache-write" und liefert beim Fehler `null` als `data`.
 */
export async function fetchAndCache<T>(
  url: string,
  cacheWrite: (data: T) => Promise<void>,
  cacheRead?: () => Promise<T | null>,
  init?: RequestInit
): Promise<{ data: T | null; fromCache: boolean; ok: boolean }> {
  try {
    const res = await fetch(url, init)
    const json = (await res.json()) as { success?: boolean; data?: T }
    if (res.ok && json.success && json.data !== undefined) {
      try {
        await cacheWrite(json.data)
      } catch (err) {
        console.warn('cacheWrite failed for', url, err)
      }
      return { data: json.data, fromCache: false, ok: true }
    }
  } catch {
    // Netzwerkfehler -> Cache-Fallback
  }
  if (cacheRead) {
    try {
      const cached = await cacheRead()
      if (cached !== null && cached !== undefined) {
        return { data: cached, fromCache: true, ok: true }
      }
    } catch (err) {
      console.warn('cacheRead failed for', url, err)
    }
  }
  return { data: null, fromCache: false, ok: false }
}

// ---------------------------------------------------------------------------
// Read-Pfade (getCached*)
// ---------------------------------------------------------------------------

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

export async function getCachedTagKategorien(): Promise<TagKategorie[]> {
  const rows = await offlineDb.tagKategorien.toArray()
  return rows.map(stripMeta).sort((a, b) => a.reihenfolge - b.reihenfolge)
}

export async function getCachedMitreisende(): Promise<Mitreisender[]> {
  const rows = await offlineDb.mitreisende.toArray()
  return rows.map(stripMeta)
}

/** Mitreisende eines konkreten Urlaubs */
export async function getCachedVacationMitreisende(
  vacationId: string
): Promise<Mitreisender[]> {
  const rows = await offlineDb.vacationMitreisende
    .where('_vacationId')
    .equals(vacationId)
    .toArray()
  return rows.map((r) => {
    const stripped = stripMeta(r) as Mitreisender & { id_compound?: string }
    delete stripped.id_compound
    return stripped as Mitreisender
  })
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
  const list = rows.map(stripMeta) as PackingItem[]
  return sortPackingItemsForDisplay(list)
}

/** Aus IndexedDB lesen: Checklisten (inkl. Kategorien & Einträgen) */
export async function getCachedChecklisten(): Promise<ChecklisteMitStruktur[]> {
  const rows = await offlineDb.checklisten.toArray()
  return rows
    .map(stripMeta)
    .sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel))
}

/** Aus IndexedDB lesen: zuletzt bekannte GPS-Position */
export async function getCachedLastPosition(): Promise<{ lat: number; lng: number } | null> {
  const row = await offlineDb.lastPosition.get('last')
  if (!row) return null
  return { lat: row.lat, lng: row.lng }
}

export async function getCachedPackStatus(
  vacationId: string
): Promise<PackStatusData | null> {
  const row = await offlineDb.packStatus.get(vacationId)
  return row?.data ?? null
}

export async function getCachedCampingplaetze(): Promise<Campingplatz[]> {
  const rows = await offlineDb.campingplaetze.toArray()
  return rows.map(stripMeta)
}

export async function getCachedCampingplatz(id: string): Promise<Campingplatz | null> {
  const row = await offlineDb.campingplaetze.get(id)
  return row ? stripMeta(row) : null
}

export async function getCachedCampingplatzFotos(
  campingplatzId: string
): Promise<CampingplatzFoto[]> {
  const rows = await offlineDb.campingplaetzeFotos
    .where('campingplatz_id')
    .equals(campingplatzId)
    .toArray()
  return rows.map(stripMeta).sort((a, b) => a.sort_index - b.sort_index)
}

export async function getCachedRoute(
  userId: string,
  campingplatzId: string
): Promise<CampingplatzRouteCacheEntry | null> {
  const row = await offlineDb.routes.get(`${userId}|${campingplatzId}`)
  if (!row) return null
  // _cachedAt + zusammengesetzte id entfernen
  const { _cachedAt, id, ...rest } = row
  void _cachedAt
  void id
  return rest as CampingplatzRouteCacheEntry
}

export async function getCachedHomeLocation(): Promise<{
  heimat_adresse: string | null
  heimat_lat: number | null
  heimat_lng: number | null
} | null> {
  const row = await offlineDb.homeLocation.get('me')
  if (!row) return null
  return {
    heimat_adresse: row.heimat_adresse,
    heimat_lat: row.heimat_lat,
    heimat_lng: row.heimat_lng,
  }
}

export async function getCachedAuthUser(): Promise<{
  id: string
  email: string
  role: 'admin' | 'kind' | 'gast'
  mitreisender_id: string | null
  permissions: string[]
  must_change_password?: boolean
} | null> {
  const row = await offlineDb.authUser.get('me')
  if (!row) return null
  return {
    id: row.user_id,
    email: row.email,
    role: row.role,
    mitreisender_id: row.mitreisender_id,
    permissions: row.permissions,
    must_change_password: row.must_change_password,
  }
}

function stripMeta<T extends object>(row: T): Omit<T, '_cachedAt' | '_updatedAt' | '_vacationId'> {
  const { _cachedAt, _updatedAt, _vacationId, ...rest } = row as T &
    { _cachedAt?: unknown; _updatedAt?: unknown; _vacationId?: unknown }
  return rest as Omit<T, '_cachedAt' | '_updatedAt' | '_vacationId'>
}

/** Cache-Funktionen für jede Entität */
export const cacheFns = {
  vacations: cacheVacations,
  equipment: cacheEquipment,
  categories: cacheCategories,
  mainCategories: cacheMainCategories,
  tags: cacheTags,
  tagKategorien: cacheTagKategorien,
  mitreisende: cacheMitreisende,
  vacationMitreisende: cacheVacationMitreisende,
  transportVehicles: cacheTransportVehicles,
  packingItems: cachePackingItems,
  checklisten: cacheChecklisten,
  lastPosition: cacheLastPosition,
  packStatus: cachePackStatus,
  campingplaetze: cacheCampingplaetze,
  campingplatz: cacheCampingplatz,
  campingplatzFotos: cacheCampingplatzFotos,
  route: cacheRoute,
  homeLocation: cacheHomeLocation,
  authUser: cacheAuthUser,
}

// ---------------------------------------------------------------------------
// Sync-Queue (Outbox)
// ---------------------------------------------------------------------------

export type SyncAction = 'put' | 'delete' | 'post' | 'patch'

/** Sync-Queue: Eintrag hinzufügen (bei Offline-Mutation) */
export async function enqueueSync(
  table: string,
  action: SyncAction,
  key: string,
  payload?: unknown,
  context?: Record<string, string>
): Promise<number> {
  const id = await offlineDb.syncQueue.add({
    table,
    action,
    key,
    payload,
    context,
    timestamp: Date.now(),
    attempts: 0,
  })
  // Dexie liefert bei auto-incrementing Tabellen die generierte ID; Typ ist `number | undefined`.
  return typeof id === 'number' ? id : Number(id ?? 0)
}

/** Anzahl ausstehender Sync-Einträge */
export async function getSyncQueueCount(): Promise<number> {
  return await offlineDb.syncQueue.count()
}

/** Liefert alle Einträge in zeitlicher Reihenfolge (für UI) */
export async function getSyncQueueEntries(): Promise<SyncQueueEntry[]> {
  return await offlineDb.syncQueue.orderBy('timestamp').toArray()
}

/** Einzelnen Eintrag entfernen (UI: "Verwerfen") */
export async function deleteSyncQueueEntry(id: number): Promise<void> {
  await offlineDb.syncQueue.delete(id)
}

/**
 * Sync-Queue abarbeiten (bei Reconnect / manuell). Bricht bei einem Netzwerkfehler ab,
 * damit nachfolgende Einträge nicht in falscher Reihenfolge ankommen. Beim nächsten
 * Online-Event wird erneut versucht.
 */
export async function processSyncQueue(): Promise<{ ok: number; failed: number; remaining: number }> {
  const entries = await offlineDb.syncQueue.orderBy('timestamp').toArray()
  let ok = 0
  let failed = 0

  for (const e of entries) {
    try {
      const result = await sendQueueEntry(e)
      if (result === 'ok') {
        if (e.id != null) await offlineDb.syncQueue.delete(e.id)
        ok++
      } else if (result === 'drop') {
        if (e.id != null) await offlineDb.syncQueue.delete(e.id)
        failed++
      } else {
        failed++
        // Bei Netzwerkfehler abbrechen, damit Reihenfolge erhalten bleibt
        await offlineDb.syncQueue.update(e.id!, {
          attempts: (e.attempts ?? 0) + 1,
          lastError: 'network',
        })
        break
      }
    } catch (err) {
      failed++
      await offlineDb.syncQueue.update(e.id!, {
        attempts: (e.attempts ?? 0) + 1,
        lastError: err instanceof Error ? err.message : String(err),
      })
      break
    }
  }

  const remaining = await offlineDb.syncQueue.count()
  return { ok, failed, remaining }
}

/**
 * Mappt einen Sync-Queue-Eintrag auf einen konkreten API-Aufruf.
 * Rückgabe:
 *  - `'ok'`     → Server hat akzeptiert, Eintrag aus Queue entfernen.
 *  - `'drop'`   → Server hat 4xx geantwortet (Konflikt o. ä.), nicht erneut versuchen.
 *  - `'retry'`  → Netzwerkproblem / 5xx, Eintrag bleibt für nächsten Reconnect.
 */
async function sendQueueEntry(e: SyncQueueEntry): Promise<'ok' | 'drop' | 'retry'> {
  const route = resolveRoute(e)
  if (!route) {
    console.warn('SyncQueue: kein Routen-Mapping für', e.table, e.action, e.key)
    return 'drop'
  }
  const { method, url, body } = route
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (res.ok) return 'ok'
    if (res.status >= 400 && res.status < 500) {
      console.warn('SyncQueue: 4xx, verwerfe Eintrag', e.table, e.action, e.key, res.status)
      return 'drop'
    }
    return 'retry'
  } catch {
    return 'retry'
  }
}

interface ResolvedRoute {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
}

/** Statisches Routing-Tabelle für Outbox-Einträge. */
function resolveRoute(e: SyncQueueEntry): ResolvedRoute | null {
  const ctx = e.context ?? {}
  switch (e.table) {
    case 'packing-items': {
      // key = packingItemId; payload = vollständiges Update-Objekt
      if (e.action === 'patch' || e.action === 'put') {
        return {
          method: 'PUT',
          url: '/api/packing-items',
          body: { id: e.key, ...(e.payload as object) },
        }
      }
      if (e.action === 'post') {
        return { method: 'POST', url: '/api/packing-items', body: e.payload }
      }
      if (e.action === 'delete') {
        return { method: 'DELETE', url: `/api/packing-items?id=${encodeURIComponent(e.key)}` }
      }
      return null
    }
    case 'packing-items-toggle-mitreisender': {
      // payload = { packingItemId, mitreisenderId, gepackt }
      return { method: 'POST', url: '/api/packing-items/toggle-mitreisender', body: e.payload }
    }
    case 'packing-items-set-mitreisender-anzahl': {
      return {
        method: 'POST',
        url: '/api/packing-items/set-mitreisender-anzahl',
        body: e.payload,
      }
    }
    case 'packing-items-confirm-vorgemerkt': {
      return {
        method: 'POST',
        url: '/api/packing-items/confirm-vorgemerkt',
        body: e.payload,
      }
    }
    case 'packing-items-batch': {
      return { method: 'POST', url: '/api/packing-items/batch', body: e.payload }
    }
    case 'checklisten-eintrag-erledigt': {
      // key = `${checklistId}|${eintragId}`, payload = { erledigt }
      const checklistId = ctx.checklistId
      const eintragId = ctx.eintragId
      if (!checklistId || !eintragId) return null
      return {
        method: 'PATCH',
        url: `/api/checklisten/${encodeURIComponent(checklistId)}/eintraege/${encodeURIComponent(eintragId)}`,
        body: e.payload,
      }
    }
    default:
      return null
  }
}
