import { haversineDistanceKm } from '@/lib/routes'
import type { VacationCampingStay } from '@/lib/db'

export type GeoPoint = { lat: number; lng: number }

/** Großzügig: GPS-Streuung, Ortskern vs. Platz, Anfahrt auf den letzten Kilometern. */
export const SUN_ARRIVAL_RADIUS_KM = 20

/** Noch am Start (Zuhause oder vorheriger Platz). */
export const SUN_ORIGIN_RADIUS_KM = 12

export function campingStayCoords(stay: VacationCampingStay): GeoPoint | null {
  return parseGeoPoint(stay.campingplatz.lat, stay.campingplatz.lng)
}

export function parseGeoPoint(lat: unknown, lng: unknown): GeoPoint | null {
  const la = typeof lat === 'number' ? lat : typeof lat === 'string' ? Number(lat) : NaN
  const ln = typeof lng === 'number' ? lng : typeof lng === 'string' ? Number(lng) : NaN
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null
  return { lat: la, lng: ln }
}

function staySortKey(stay: VacationCampingStay): string {
  const start = stay.start_datum?.slice(0, 10) || '9999-12-31'
  const idx = String(stay.sort_index ?? 999999).padStart(6, '0')
  return `${start}:${idx}`
}

export function previousStayBefore(
  stays: VacationCampingStay[],
  current: VacationCampingStay
): VacationCampingStay | null {
  const same = stays
    .filter((s) => s.urlaub_id === current.urlaub_id)
    .sort((a, b) => staySortKey(a).localeCompare(staySortKey(b)))
  const i = same.findIndex((s) => s.id === current.id)
  if (i <= 0) return null
  return same[i - 1] ?? null
}

/**
 * Ankunft am Zielcampingplatz.
 * Keine Ziel-Koordinaten → GPS-Kriterium ignorieren.
 * Kein User-Standort bei bekannten Ziel-Koordinaten → noch nicht anzeigen
 * (sonst blitzt die Karte zuhause auf).
 */
export function hasArrivedAtCampingForSunCard(opts: {
  destination: GeoPoint | null
  origin: GeoPoint | null
  user: GeoPoint | null
}): boolean {
  if (!opts.destination) return true
  if (!opts.user) return false

  const distDestKm = haversineDistanceKm({
    lat1: opts.user.lat,
    lng1: opts.user.lng,
    lat2: opts.destination.lat,
    lng2: opts.destination.lng,
  })
  if (distDestKm > SUN_ARRIVAL_RADIUS_KM) return false

  if (opts.origin) {
    const distOriginKm = haversineDistanceKm({
      lat1: opts.user.lat,
      lng1: opts.user.lng,
      lat2: opts.origin.lat,
      lng2: opts.origin.lng,
    })
    if (distOriginKm <= SUN_ORIGIN_RADIUS_KM && distOriginKm < distDestKm) return false
  }

  return true
}
