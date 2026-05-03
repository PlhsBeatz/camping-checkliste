/**
 * IndexedDB (Dexie) für Offline-Cache der D1-Daten.
 * Speichert: Urlaube, Ausrüstung, Kategorien, Tags, Mitreisende, Transportmittel, Packlisten-Einträge.
 * Sync-Queue für Änderungen, die beim Reconnect mit Last-Write-Wins gesendet werden.
 */

import Dexie, { type EntityTable } from 'dexie'
import type {
  Vacation,
  EquipmentItem,
  Category,
  MainCategory,
  Tag,
  Mitreisender,
  TransportVehicle,
  PackingItem,
  ChecklisteMitStruktur,
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

/** Einzelne Änderung in der Offline-Queue (Last-Write-Wins) */
export interface SyncQueueEntry {
  id?: number
  table: string
  action: 'put' | 'delete'
  key: string
  payload?: unknown
  timestamp: number
}

export class OfflineDB extends Dexie {
  vacations!: EntityTable<CachedVacation, 'id'>
  equipment!: EntityTable<CachedEquipmentItem, 'id'>
  categories!: EntityTable<CachedCategory, 'id'>
  mainCategories!: EntityTable<CachedMainCategory, 'id'>
  tags!: EntityTable<CachedTag, 'id'>
  mitreisende!: EntityTable<CachedMitreisender, 'id'>
  transportVehicles!: EntityTable<CachedTransportVehicle, 'id'>
  packingItems!: EntityTable<CachedPackingItem, 'id'>
  checklisten!: EntityTable<CachedChecklist, 'id'>
  lastPosition!: EntityTable<CachedLastPosition, 'id'>
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
    // Version 2: Tabellen für die neuen Tools (Checklisten + zuletzt bekannte Position)
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

/** Batch in IndexedDB speichern */
export async function cacheVacations(items: Vacation[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedVacation[]
  await offlineDb.vacations.bulkPut(withMetaItems)
}

export async function cacheEquipment(items: EquipmentItem[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedEquipmentItem[]
  await offlineDb.equipment.bulkPut(withMetaItems)
}

export async function cacheCategories(
  items: Array<Category & { hauptkategorie_titel?: string }>
): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedCategory[]
  await offlineDb.categories.bulkPut(withMetaItems)
}

export async function cacheMainCategories(items: MainCategory[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedMainCategory[]
  await offlineDb.mainCategories.bulkPut(withMetaItems)
}

export async function cacheTags(items: Tag[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedTag[]
  await offlineDb.tags.bulkPut(withMetaItems)
}

export async function cacheMitreisende(items: Mitreisender[]): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedMitreisender[]
  await offlineDb.mitreisende.bulkPut(withMetaItems)
}

export async function cacheTransportVehicles(
  items: TransportVehicle[]
): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedTransportVehicle[]
  await offlineDb.transportVehicles.bulkPut(withMetaItems)
}

export async function cachePackingItems(
  vacationId: string,
  items: PackingItem[]
): Promise<void> {
  await offlineDb.packingItems.where('_vacationId').equals(vacationId).delete()
  const withMetaItems = items.map((v) =>
    withMeta({ ...v, _vacationId: vacationId })
  ) as CachedPackingItem[]
  await offlineDb.packingItems.bulkPut(withMetaItems)
}

/**
 * Komplette Checklisten-Liste cachen.
 * Wir ersetzen den Cache vollständig, damit gelöschte Listen nicht im Cache "weiterleben".
 */
export async function cacheChecklisten(
  items: ChecklisteMitStruktur[]
): Promise<void> {
  const withMetaItems = items.map((v) => withMeta(v)) as CachedChecklist[]
  await offlineDb.checklisten.clear()
  if (withMetaItems.length > 0) {
    await offlineDb.checklisten.bulkPut(withMetaItems)
  }
}

/** Zuletzt bekannte GPS-Position speichern (Tools/Sonnen-Ausrichtung) */
export async function cacheLastPosition(lat: number, lng: number): Promise<void> {
  await offlineDb.lastPosition.put({
    id: 'last',
    lat,
    lng,
    _cachedAt: now(),
  })
}
