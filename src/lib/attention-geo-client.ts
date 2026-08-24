import { cacheLastPosition } from '@/lib/offline-db'
import { getCachedLastPosition } from '@/lib/offline-sync'
import { parseGeoPoint, type GeoPoint } from '@/lib/sonnen-hub-arrival'

export function attentionCoordsQuery(pos: GeoPoint | null | undefined): string {
  if (!pos) return ''
  return `&lat=${encodeURIComponent(String(pos.lat))}&lng=${encodeURIComponent(String(pos.lng))}`
}

export async function getCachedAttentionPosition(): Promise<GeoPoint | null> {
  const cached = await getCachedLastPosition().catch(() => null)
  return cached ? parseGeoPoint(cached.lat, cached.lng) : null
}

export function getLiveAttentionPosition(): Promise<GeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(parseGeoPoint(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(null),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 }
    )
  })
}

export async function rememberAttentionPosition(pos: GeoPoint): Promise<void> {
  await cacheLastPosition(pos.lat, pos.lng).catch(() => {})
}
