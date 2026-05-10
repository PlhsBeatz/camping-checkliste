/**
 * IndexedDB (Dexie) für Offline-Cache der D1-Daten.
 * Speichert: Urlaube, Ausrüstung, Kategorien, Tags, Mitreisende, Transportmittel, Packlisten-Einträge,
 * Tools-Checklisten, letzte GPS-Position, Tag-Kategorien, Pack-Status, Campingplätze (+ Fotos),
 * Routen, Profil-Heimat-Adresse und letzte Auth-Session.
 *
 * Außerdem: Sync-Queue für Mutationen, die bei Reconnect mit Last-Write-Wins gesendet werden.
 */

import Dexie, { type EntityTable } from 'dexie'
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

export interface CachedVacation extends Vacation {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedEquipmentItem extends EquipmentItem {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedCategory extends Category {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedMainCategory extends MainCategory {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedTag extends Tag {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedTagKategorie extends TagKategorie {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedMitreisender extends Mitreisender {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedTransportVehicle extends TransportVehicle {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedPackingItem extends PackingItem {
  _vacationId: string
  _cachedAt: number
  _updatedAt: number
}

/**
 * Mitreisende eines konkreten Urlaubs werden zusätzlich pro Urlaub gecacht.
 * Compound-ID `${vacationId}|${mitreisenderId}`, damit Dexie pro Urlaub bereinigen kann.
 */
export interface CachedVacationMitreisender extends Mitreisender {
  /** `${vacationId}|${mitreisenderId}` */
  id_compound: string
  _vacationId: string
  _cachedAt: number
  _updatedAt: number
}

/**
 * Tools/Checklisten werden als verschachtelter Baum vom Server geliefert.
 * Wir cachen pro Checkliste einen Eintrag (key = id), inklusive Kategorien und Einträgen.
 */
export interface CachedChecklist extends ChecklisteMitStruktur {
  _cachedAt: number
  _updatedAt: number
}

/** Cache für die letzte bekannte GPS-Position (Tools/Sonnen-Ausrichtung) */
export interface CachedLastPosition {
  /** Stabiler Schlüssel, aktuell immer 'last' (eine Position pro Gerät) */
  id: string
  lat: number
  lng: number
  _cachedAt: number
}

/** Pack-Status-Snapshot pro Urlaub */
export interface CachedPackStatus {
  /** vacation_id */
  id: string
  data: PackStatusData
  _cachedAt: number
  _updatedAt: number
}

export interface CachedCampingplatz extends Campingplatz {
  _cachedAt: number
  _updatedAt: number
}

export interface CachedCampingplatzFoto extends CampingplatzFoto {
  _cachedAt: number
  _updatedAt: number
}

/** Routen-Cache: Schlüssel `${userId}|${campingplatzId}` */
export interface CachedRoute extends CampingplatzRouteCacheEntry {
  /** `${userId}|${campingplatzId}` */
  id: string
  _cachedAt: number
}

/** Profil-Heimat-Adresse (eine pro User-Session, key = 'me') */
export interface CachedHomeLocation {
  id: string
  heimat_adresse: string | null
  heimat_lat: number | null
  heimat_lng: number | null
  _cachedAt: number
  _updatedAt: number
}

/** Letzter bekannter Auth-User (eine Zeile, key = 'me') */
export interface CachedAuthUser {
  id: string
  user_id: string
  email: string
  role: 'admin' | 'kind' | 'gast'
  mitreisender_id: string | null
  permissions: string[]
  must_change_password?: boolean
  _cachedAt: number
}

/** Einzelne Änderung in der Offline-Queue (Last-Write-Wins) */
export interface SyncQueueEntry {
  id?: number
  table: string
  action: 'put' | 'delete' | 'post' | 'patch'
  /** Logischer Schlüssel: meist Entitäts-ID; bei reorder/etc. eine zusammengesetzte Kennung */
  key: string
  /** Body / Payload für die Mutation (wird beim Send zu JSON serialisiert) */
  payload?: unknown
  /** Optional: zusätzliche Routen-Info (z. B. parent-IDs für nested-Endpoints) */
  context?: Record<string, string>
  timestamp: number
  /** Versuchszähler für Backoff */
  attempts?: number
  /** Letzte Fehlermeldung */
  lastError?: string
}

export class OfflineDB extends Dexie {
  vacations!: EntityTable<CachedVacation, 'id'>
  equipment!: EntityTable<CachedEquipmentItem, 'id'>
  categories!: EntityTable<CachedCategory, 'id'>
  mainCategories!: EntityTable<CachedMainCategory, 'id'>
  tags!: EntityTable<CachedTag, 'id'>
  tagKategorien!: EntityTable<CachedTagKategorie, 'id'>
  mitreisende!: EntityTable<CachedMitreisender, 'id'>
  vacationMitreisende!: EntityTable<CachedVacationMitreisender, 'id_compound'>
  transportVehicles!: EntityTable<CachedTransportVehicle, 'id'>
  packingItems!: EntityTable<CachedPackingItem, 'id'>
  checklisten!: EntityTable<CachedChecklist, 'id'>
  lastPosition!: EntityTable<CachedLastPosition, 'id'>
  packStatus!: EntityTable<CachedPackStatus, 'id'>
  campingplaetze!: EntityTable<CachedCampingplatz, 'id'>
  campingplaetzeFotos!: EntityTable<CachedCampingplatzFoto, 'id'>
  routes!: EntityTable<CachedRoute, 'id'>
  homeLocation!: EntityTable<CachedHomeLocation, 'id'>
  authUser!: EntityTable<CachedAuthUser, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>

  constructor() {
    super('CampingChecklisteOffline')
    this.version(1).stores({
      vacations: 'id, _cachedAt, _updatedAt',
      equipment: 'id, _cachedAt, _updatedAt',
      categories: 'id, _cachedAt, _updatedAt',
      mainCategories: 'id, _cachedAt, _updatedAt',
      tags: 'id, _cachedAt, _updatedAt',
      mitreisende: 'id, _cachedAt, _updatedAt',
      transportVehicles: 'id, _cachedAt, _updatedAt',
      packingItems: 'id, packliste_id, _vacationId, _cachedAt, _updatedAt',
      syncQueue: '++id, table, timestamp',
    })
    // Version 2: Tools (Checklisten + zuletzt bekannte Position)
    this.version(2).stores({
      vacations: 'id, _cachedAt, _updatedAt',
      equipment: 'id, _cachedAt, _updatedAt',
      categories: 'id, _cachedAt, _updatedAt',
      mainCategories: 'id, _cachedAt, _updatedAt',
      tags: 'id, _cachedAt, _updatedAt',
      mitreisende: 'id, _cachedAt, _updatedAt',
      transportVehicles: 'id, _cachedAt, _updatedAt',
      packingItems: 'id, packliste_id, _vacationId, _cachedAt, _updatedAt',
      checklisten: 'id, reihenfolge, _cachedAt, _updatedAt',
      lastPosition: 'id, _cachedAt',
      syncQueue: '++id, table, timestamp',
    })
    // Version 3: Auth, Tag-Kategorien, Mitreisende-pro-Urlaub, Pack-Status,
    // Campingplätze (+ Fotos), Routen, Heimat-Adresse
    this.version(3).stores({
      vacations: 'id, _cachedAt, _updatedAt',
      equipment: 'id, _cachedAt, _updatedAt',
      categories: 'id, _cachedAt, _updatedAt',
      mainCategories: 'id, _cachedAt, _updatedAt',
      tags: 'id, _cachedAt, _updatedAt',
      tagKategorien: 'id, reihenfolge, _cachedAt, _updatedAt',
      mitreisende: 'id, _cachedAt, _updatedAt',
      vacationMitreisende: 'id_compound, _vacationId, _cachedAt, _updatedAt',
      transportVehicles: 'id, _cachedAt, _updatedAt',
      packingItems: 'id, packliste_id, _vacationId, _cachedAt, _updatedAt',
      checklisten: 'id, reihenfolge, _cachedAt, _updatedAt',
      lastPosition: 'id, _cachedAt',
      packStatus: 'id, _cachedAt, _updatedAt',
      campingplaetze: 'id, _cachedAt, _updatedAt',
      campingplaetzeFotos: 'id, campingplatz_id, _cachedAt, _updatedAt',
      routes: 'id, _cachedAt',
      homeLocation: 'id, _cachedAt, _updatedAt',
      authUser: 'id, _cachedAt',
      syncQueue: '++id, table, timestamp, attempts',
    })
  }
}

export const offlineDb = new OfflineDB()

const now = () => Date.now()

/** Hilfsfunktion: Objekt mit Cache-Metadaten versehen */
function withMeta<T>(obj: T): T & { _cachedAt: number; _updatedAt: number } {
  const t = now()
  return { ...obj, _cachedAt: t, _updatedAt: t } as T & {
    _cachedAt: number
    _updatedAt: number
  }
}

/**
 * "Snapshot Replace": ersetzt eine Tabelle vollständig durch die übergebene Liste.
 * Nötig, weil ein reines bulkPut Datensätze, die serverseitig gelöscht wurden,
 * nicht aus dem lokalen Cache entfernen würde.
 */
async function snapshotReplace<T>(
  table: { clear: () => Promise<void>; bulkPut: (items: T[]) => Promise<unknown> },
  items: T[]
): Promise<void> {
  await table.clear()
  if (items.length > 0) {
    await table.bulkPut(items)
  }
}

export async function cacheVacations(items: Vacation[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedVacation[]
  await snapshotReplace(offlineDb.vacations, withMetaItems)
}

export async function cacheEquipment(items: EquipmentItem[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedEquipmentItem[]
  await snapshotReplace(offlineDb.equipment, withMetaItems)
}

export async function cacheCategories(
  items: Array<Category & { hauptkategorie_titel?: string }>
): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedCategory[]
  await snapshotReplace(offlineDb.categories, withMetaItems)
}

export async function cacheMainCategories(items: MainCategory[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedMainCategory[]
  await snapshotReplace(offlineDb.mainCategories, withMetaItems)
}

export async function cacheTags(items: Tag[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedTag[]
  await snapshotReplace(offlineDb.tags, withMetaItems)
}

export async function cacheTagKategorien(items: TagKategorie[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedTagKategorie[]
  await snapshotReplace(offlineDb.tagKategorien, withMetaItems)
}

export async function cacheMitreisende(items: Mitreisender[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedMitreisender[]
  await snapshotReplace(offlineDb.mitreisende, withMetaItems)
}

/** Mitreisende, die einem konkreten Urlaub zugeordnet sind */
export async function cacheVacationMitreisende(
  vacationId: string,
  items: Mitreisender[]
): Promise<void> {
  await offlineDb.vacationMitreisende.where('_vacationId').equals(vacationId).delete()
  const withMetaItems = items.map((v) =>
    withMeta({
      ...v,
      id_compound: `${vacationId}|${v.id}`,
      _vacationId: vacationId,
    })
  ) as CachedVacationMitreisender[]
  if (withMetaItems.length > 0) {
    await offlineDb.vacationMitreisende.bulkPut(withMetaItems)
  }
}

export async function cacheTransportVehicles(
  items: TransportVehicle[]
): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedTransportVehicle[]
  await snapshotReplace(offlineDb.transportVehicles, withMetaItems)
}

export async function cachePackingItems(
  vacationId: string,
  items: PackingItem[]
): Promise<void> {
  await offlineDb.packingItems.where('_vacationId').equals(vacationId).delete()
  const withMetaItems = items.map((v) =>
    withMeta({ ...v, _vacationId: vacationId })
  ) as CachedPackingItem[]
  if (withMetaItems.length > 0) {
    await offlineDb.packingItems.bulkPut(withMetaItems)
  }
}

/** Komplette Checklisten-Liste cachen (Snapshot-Replace). */
export async function cacheChecklisten(
  items: ChecklisteMitStruktur[]
): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedChecklist[]
  await snapshotReplace(offlineDb.checklisten, withMetaItems)
}

/** Zuletzt bekannte GPS-Position speichern */
export async function cacheLastPosition(lat: number, lng: number): Promise<void> {
  await offlineDb.lastPosition.put({
    id: 'last',
    lat,
    lng,
    _cachedAt: now(),
  })
}

/** Pack-Status pro Urlaub als ganzen Snapshot ablegen */
export async function cachePackStatus(
  vacationId: string,
  data: PackStatusData
): Promise<void> {
  const t = now()
  await offlineDb.packStatus.put({
    id: vacationId,
    data,
    _cachedAt: t,
    _updatedAt: t,
  })
}

/**
 * Stellt `aufwunschliste` und `top_favorit` für IndexedDB sicher (API + alte Cache-Zeilen).
 * `route_from_home` bleibt unverändert mitgeschrieben, sofern von der Liste geliefert.
 */
export function normalizeCampingplatzForOfflineCache(cp: Campingplatz): Campingplatz {
  return {
    ...cp,
    aufwunschliste: (cp as { aufwunschliste?: boolean }).aufwunschliste !== false,
    top_favorit: !!(cp as { top_favorit?: boolean }).top_favorit,
  }
}

export async function cacheCampingplaetze(
  items: Campingplatz[]
): Promise<void> {
  const withMetaItems = items
    .map((v) => withMeta(normalizeCampingplatzForOfflineCache(v)))
    .map((v) => v as CachedCampingplatz)
  await snapshotReplace(offlineDb.campingplaetze, withMetaItems)
}

export async function cacheCampingplatz(
  item: Campingplatz
): Promise<void> {
  await offlineDb.campingplaetze.put(
    withMeta(normalizeCampingplatzForOfflineCache(item)) as CachedCampingplatz
  )
}

/** Fotos für genau einen Campingplatz spiegeln */
export async function cacheCampingplatzFotos(
  campingplatzId: string,
  items: CampingplatzFoto[]
): Promise<void> {
  await offlineDb.campingplaetzeFotos
    .where('campingplatz_id')
    .equals(campingplatzId)
    .delete()
  const withMetaItems = items.map((v) => withMeta(v)) as CachedCampingplatzFoto[]
  if (withMetaItems.length > 0) {
    await offlineDb.campingplaetzeFotos.bulkPut(withMetaItems)
  }
}

/** Routen-Cache für `${userId}|${campingplatzId}` schreiben. */
export async function cacheRoute(
  userId: string,
  entry: CampingplatzRouteCacheEntry
): Promise<void> {
  await offlineDb.routes.put({
    ...entry,
    id: `${userId}|${entry.campingplatz_id}`,
    _cachedAt: now(),
  })
}

/** Heimat-Adresse des Users (eine Zeile pro Gerät) */
export async function cacheHomeLocation(loc: {
  heimat_adresse: string | null
  heimat_lat: number | null
  heimat_lng: number | null
}): Promise<void> {
  const t = now()
  await offlineDb.homeLocation.put({
    id: 'me',
    heimat_adresse: loc.heimat_adresse,
    heimat_lat: loc.heimat_lat,
    heimat_lng: loc.heimat_lng,
    _cachedAt: t,
    _updatedAt: t,
  })
}

/** Letzten Auth-User in Cache schreiben (nur Read-Only-Spiegelung) */
export async function cacheAuthUser(user: {
  id: string
  email: string
  role: 'admin' | 'kind' | 'gast'
  mitreisender_id: string | null
  permissions: string[]
  must_change_password?: boolean
}): Promise<void> {
  await offlineDb.authUser.put({
    id: 'me',
    user_id: user.id,
    email: user.email,
    role: user.role,
    mitreisender_id: user.mitreisender_id,
    permissions: user.permissions,
    must_change_password: user.must_change_password,
    _cachedAt: now(),
  })
}

/** Auth-Cache löschen (z. B. bei Logout) */
export async function clearAuthUser(): Promise<void> {
  await offlineDb.authUser.clear()
}
