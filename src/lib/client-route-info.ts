import type {
  CampingplatzRouteCacheEntry,
  CampingplatzSegmentRouteCacheEntry,
} from '@/lib/db'
import { isHomeRouteCacheComplete, isUsableRoutePolyline } from '@/lib/route-polyline'

/** Max. API-Versuche pro Route-Schlüssel pro Browser-Session (gegen Retry-Schleifen). */
export const MAX_ROUTE_FETCH_ATTEMPTS = 2

/** Max. neue Routen-API-Calls pro Besuch der Urlaubs-Übersicht. */
export const OVERVIEW_MAX_ROUTE_API_FETCHES = 4

export type CampingplatzRouteInfo = {
  distanceKm: number
  durationMinutes: number
  provider?: 'google' | 'haversine'
  encodedPolyline?: string | null
  returnEncodedPolyline?: string | null
}

const fetchAttempts = new Map<string, number>()

export function routeFetchKey(kind: 'camping' | 'segment', id: string): string {
  return `${kind}:${id}`
}

export function shouldFetchRoute(key: string): boolean {
  return (fetchAttempts.get(key) ?? 0) < MAX_ROUTE_FETCH_ATTEMPTS
}

export function recordRouteFetchAttempt(key: string): void {
  fetchAttempts.set(key, (fetchAttempts.get(key) ?? 0) + 1)
}

export function resetRouteFetchAttempts(key: string): void {
  fetchAttempts.delete(key)
}

/** Übersicht: Entfernung reicht (keine Polylines nötig). */
export function isOverviewRouteComplete(info: CampingplatzRouteInfo | undefined): boolean {
  return !!info && typeof info.distanceKm === 'number' && info.distanceKm >= 0
}

/**
 * Detailseite: voller Heimat↔Platz-Cache oder Abbruch nach max. Versuchen
 * (dann reicht Hin-Route / Entfernung, Rückweg nutzt Fallback-Polyline).
 */
export function isDetailHomeRouteComplete(
  info: CampingplatzRouteInfo | undefined,
  fetchKey?: string
): boolean {
  if (isHomeRouteCacheComplete(info)) return true
  if (fetchKey && !shouldFetchRoute(fetchKey) && isOverviewRouteComplete(info)) return true
  return false
}

export function cacheEntryToRouteInfo(entry: CampingplatzRouteCacheEntry): CampingplatzRouteInfo {
  return {
    distanceKm: entry.distance_km,
    durationMinutes: entry.duration_min,
    provider: entry.provider,
    encodedPolyline: entry.encoded_polyline ?? null,
    returnEncodedPolyline: entry.return_encoded_polyline ?? null,
  }
}

export function routeInfoToCacheEntry(
  userId: string,
  campingplatzId: string,
  info: CampingplatzRouteInfo
): CampingplatzRouteCacheEntry {
  return {
    user_id: userId,
    campingplatz_id: campingplatzId,
    distance_km: info.distanceKm,
    duration_min: info.durationMinutes,
    provider: info.provider ?? 'google',
    encoded_polyline: info.encodedPolyline ?? null,
    return_encoded_polyline: info.returnEncodedPolyline ?? null,
    updated_at: new Date().toISOString(),
  }
}

export function segmentCacheEntryToRouteInfo(
  entry: CampingplatzSegmentRouteCacheEntry
): CampingplatzRouteInfo {
  return {
    distanceKm: entry.distance_km,
    durationMinutes: entry.duration_min,
    provider: entry.provider,
    encodedPolyline: entry.encoded_polyline ?? null,
  }
}

export function routeInfoToSegmentCacheEntry(
  fromId: string,
  toId: string,
  info: CampingplatzRouteInfo
): CampingplatzSegmentRouteCacheEntry {
  return {
    from_campingplatz_id: fromId,
    to_campingplatz_id: toId,
    distance_km: info.distanceKm,
    duration_min: info.durationMinutes,
    provider: info.provider ?? 'google',
    encoded_polyline: info.encodedPolyline ?? null,
    updated_at: new Date().toISOString(),
  }
}

export function isSegmentRouteComplete(
  info: CampingplatzRouteInfo | undefined,
  fetchKey?: string
): boolean {
  if (info?.provider === 'haversine') return isOverviewRouteComplete(info)
  if (isUsableRoutePolyline(info?.encodedPolyline)) return true
  if (fetchKey && !shouldFetchRoute(fetchKey) && isOverviewRouteComplete(info)) return true
  return false
}

export function mergeCampingplatzRouteInfo(
  existing: CampingplatzRouteInfo | undefined,
  incoming: CampingplatzRouteInfo
): CampingplatzRouteInfo {
  const sanitize = (encoded: string | null | undefined): string | null =>
    isUsableRoutePolyline(encoded) ? encoded!.trim() : null

  const incomingPolyline = sanitize(incoming.encodedPolyline)
  const existingPolyline = sanitize(existing?.encodedPolyline)
  const incomingReturn = sanitize(incoming.returnEncodedPolyline)
  const existingReturn = sanitize(existing?.returnEncodedPolyline)

  return {
    distanceKm: incoming.distanceKm,
    durationMinutes: incoming.durationMinutes,
    provider: incoming.provider ?? existing?.provider,
    encodedPolyline: incomingPolyline ?? existingPolyline ?? null,
    returnEncodedPolyline: incomingReturn ?? existingReturn ?? null,
  }
}

export type CampingplatzRouteApiData = CampingplatzRouteInfo & {
  provider?: 'google' | 'haversine'
}

export function parseCampingplatzRouteApiData(
  data: CampingplatzRouteApiData | undefined
): CampingplatzRouteInfo | null {
  if (!data || typeof data.distanceKm !== 'number') return null
  return {
    distanceKm: data.distanceKm,
    durationMinutes: data.durationMinutes,
    provider: data.provider,
    encodedPolyline: data.encodedPolyline ?? null,
    returnEncodedPolyline: data.returnEncodedPolyline ?? null,
  }
}
