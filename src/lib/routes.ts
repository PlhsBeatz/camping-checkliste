import { D1Database } from '@cloudflare/workers-types'
import {
  Campingplatz,
  CampingplatzRouteCacheEntry,
  CampingplatzSegmentRouteCacheEntry,
  getRouteForUserAndCampingplatz,
  setRouteForUserAndCampingplatz,
  getSegmentRoute,
  setSegmentRoute,
} from '@/lib/db'
import { isUsableRoutePolyline, isHomeRouteCacheComplete } from '@/lib/route-polyline'

const EARTH_RADIUS_KM = 6371

/** Kein erneuter Google-Rückweg-Abruf innerhalb dieser Zeit (Server-Schutz). */
const RETURN_FETCH_COOLDOWN_MS = 6 * 60 * 60 * 1000

function shouldAttemptReturnFetch(existing: CampingplatzRouteCacheEntry | null): boolean {
  if (!existing) return true
  if (isUsableRoutePolyline(existing.return_encoded_polyline)) return false
  if (!isUsableRoutePolyline(existing.encoded_polyline)) return true
  if (!existing.updated_at) return true
  const ageMs = Date.now() - new Date(existing.updated_at).getTime()
  return ageMs >= RETURN_FETCH_COOLDOWN_MS
}

export function haversineDistanceKm(params: {
  lat1: number
  lng1: number
  lat2: number
  lng2: number
}): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(params.lat2 - params.lat1)
  const dLng = toRad(params.lng2 - params.lng1)
  const lat1Rad = toRad(params.lat1)
  const lat2Rad = toRad(params.lat2)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export function estimateRouteFromHaversine(distanceKm: number): {
  distanceKm: number
  durationMinutes: number
} {
  const roadDistanceKm = distanceKm * 1.4
  const durationHours = roadDistanceKm / 80
  return {
    distanceKm: roadDistanceKm,
    durationMinutes: durationHours * 60,
  }
}

function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_DISTANCE_MATRIX_API_KEY || null
}

type DirectionsResult = {
  distanceKm: number
  durationMinutes: number
  encodedPolyline: string
}

export async function callGoogleDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<DirectionsResult | null> {
  const apiKey = getGoogleMapsApiKey()
  if (!apiKey) return null

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', `${origin.lat},${origin.lng}`)
  url.searchParams.set('destination', `${destination.lat},${destination.lng}`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('mode', 'driving')

  const res = await fetch(url.toString())
  if (!res.ok) return null

  type DirectionsLeg = {
    distance?: { value: number }
    duration?: { value: number }
    steps?: Array<{ polyline?: { points?: string } }>
  }

  type DirectionsResponse = {
    status: string
    routes?: Array<{
      overview_polyline?: { points?: string }
      legs?: DirectionsLeg[]
    }>
  }

  const json = (await res.json()) as DirectionsResponse
  if (json.status !== 'OK' || !json.routes?.[0]) return null

  const route = json.routes[0]
  const encodedPolyline = route.overview_polyline?.points
  if (!encodedPolyline) return null

  let distanceMeters = 0
  let durationSeconds = 0
  for (const leg of route.legs ?? []) {
    distanceMeters += leg.distance?.value ?? 0
    durationSeconds += leg.duration?.value ?? 0
  }
  if (distanceMeters <= 0 || durationSeconds <= 0) return null

  return {
    distanceKm: distanceMeters / 1000,
    durationMinutes: (durationSeconds / 60) * 1.3,
    encodedPolyline,
  }
}

/** @deprecated Nur Fallback, wenn Directions fehlschlägt */
export async function callGoogleDistanceMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const apiKey = getGoogleMapsApiKey()
  if (!apiKey) return null

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  url.searchParams.set('origins', `${origin.lat},${origin.lng}`)
  url.searchParams.set('destinations', `${destination.lat},${destination.lng}`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('mode', 'driving')

  const res = await fetch(url.toString())
  if (!res.ok) {
    return null
  }
  type DistanceMatrixElement = {
    status: string
    distance?: { value: number }
    duration?: { value: number }
  }
  type DistanceMatrixResponse = {
    rows?: Array<{ elements?: DistanceMatrixElement[] }>
  }
  const json = (await res.json()) as DistanceMatrixResponse
  if (
    !json.rows ||
    !Array.isArray(json.rows) ||
    !json.rows[0] ||
    !json.rows[0].elements ||
    !json.rows[0].elements[0] ||
    json.rows[0].elements[0].status !== 'OK'
  ) {
    return null
  }
  const element = json.rows[0].elements[0]
  const distanceMeters = element.distance?.value
  const durationSeconds = element.duration?.value
  if (typeof distanceMeters !== 'number' || typeof durationSeconds !== 'number') {
    return null
  }
  const distanceKm = distanceMeters / 1000
  const durationMinutes = (durationSeconds / 60) * 1.3
  return { distanceKm, durationMinutes }
}

function segmentCacheComplete(entry: CampingplatzSegmentRouteCacheEntry): boolean {
  return isUsableRoutePolyline(entry.encoded_polyline)
}

export async function calculateRouteWithCaching(params: {
  db: D1Database
  userId: string
  campingplatz: Campingplatz
  userLat: number
  userLng: number
}): Promise<CampingplatzRouteCacheEntry | null> {
  const { db, userId, campingplatz, userLat, userLng } = params

  const existing = await getRouteForUserAndCampingplatz(db, userId, campingplatz.id)
  if (existing && isHomeRouteCacheComplete(existing)) {
    return existing
  }

  if (campingplatz.lat == null || campingplatz.lng == null) {
    return existing
  }

  const origin = { lat: userLat, lng: userLng }
  const destination = { lat: campingplatz.lat, lng: campingplatz.lng }

  const needsForward = !isUsableRoutePolyline(existing?.encoded_polyline)
  const needsReturn =
    !isUsableRoutePolyline(existing?.return_encoded_polyline) &&
    shouldAttemptReturnFetch(existing)

  const [forward, reverse] = await Promise.all([
    needsForward ? callGoogleDirections(origin, destination) : Promise.resolve(null),
    needsReturn ? callGoogleDirections(destination, origin) : Promise.resolve(null),
  ])

  if (forward || reverse || existing?.distance_km) {
    const entry: CampingplatzRouteCacheEntry = {
      user_id: userId,
      campingplatz_id: campingplatz.id,
      distance_km: forward?.distanceKm ?? existing?.distance_km ?? 0,
      duration_min: forward?.durationMinutes ?? existing?.duration_min ?? 0,
      provider: forward || reverse ? 'google' : (existing?.provider ?? 'google'),
      encoded_polyline:
        forward?.encodedPolyline ?? existing?.encoded_polyline ?? null,
      return_encoded_polyline:
        reverse?.encodedPolyline ?? existing?.return_encoded_polyline ?? null,
      updated_at: new Date().toISOString(),
    }
    await setRouteForUserAndCampingplatz(db, entry)
    return entry
  }

  if (existing?.distance_km) {
    return existing
  }

  const fromGoogle = await callGoogleDistanceMatrix(origin, destination)
  if (fromGoogle) {
    const entry: CampingplatzRouteCacheEntry = {
      user_id: userId,
      campingplatz_id: campingplatz.id,
      distance_km: fromGoogle.distanceKm,
      duration_min: fromGoogle.durationMinutes,
      provider: 'google',
      encoded_polyline: null,
      return_encoded_polyline: null,
      updated_at: new Date().toISOString(),
    }
    await setRouteForUserAndCampingplatz(db, entry)
    return entry
  }

  const baseDistanceKm = haversineDistanceKm({
    lat1: userLat,
    lng1: userLng,
    lat2: campingplatz.lat,
    lng2: campingplatz.lng,
  })
  const est = estimateRouteFromHaversine(baseDistanceKm)
  const entry: CampingplatzRouteCacheEntry = {
    user_id: userId,
    campingplatz_id: campingplatz.id,
    distance_km: est.distanceKm,
    duration_min: est.durationMinutes,
    provider: 'haversine',
    encoded_polyline: null,
    return_encoded_polyline: null,
    updated_at: new Date().toISOString(),
  }
  await setRouteForUserAndCampingplatz(db, entry)
  return entry
}

/**
 * Route zwischen zwei Campingplätzen (geografisch, nutzerunabhängig) – mit Caching.
 */
export async function calculateSegmentRouteWithCaching(params: {
  db: D1Database
  from: Campingplatz
  to: Campingplatz
}): Promise<CampingplatzSegmentRouteCacheEntry | null> {
  const { db, from, to } = params

  const existing = await getSegmentRoute(db, from.id, to.id)
  if (existing && segmentCacheComplete(existing)) {
    return existing
  }

  if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
    return existing
  }

  const fromGoogle = await callGoogleDirections(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng }
  )
  if (fromGoogle) {
    const entry: CampingplatzSegmentRouteCacheEntry = {
      from_campingplatz_id: from.id,
      to_campingplatz_id: to.id,
      distance_km: fromGoogle.distanceKm,
      duration_min: fromGoogle.durationMinutes,
      provider: 'google',
      encoded_polyline: fromGoogle.encodedPolyline,
      updated_at: new Date().toISOString(),
    }
    await setSegmentRoute(db, entry)
    return entry
  }

  if (existing?.distance_km) {
    return existing
  }

  const fromMatrix = await callGoogleDistanceMatrix(
    { lat: from.lat, lng: from.lng },
    { lat: to.lat, lng: to.lng }
  )
  if (fromMatrix) {
    const entry: CampingplatzSegmentRouteCacheEntry = {
      from_campingplatz_id: from.id,
      to_campingplatz_id: to.id,
      distance_km: fromMatrix.distanceKm,
      duration_min: fromMatrix.durationMinutes,
      provider: 'google',
      encoded_polyline: null,
      updated_at: new Date().toISOString(),
    }
    await setSegmentRoute(db, entry)
    return entry
  }

  const baseDistanceKm = haversineDistanceKm({
    lat1: from.lat,
    lng1: from.lng,
    lat2: to.lat,
    lng2: to.lng,
  })
  const est = estimateRouteFromHaversine(baseDistanceKm)
  const entry: CampingplatzSegmentRouteCacheEntry = {
    from_campingplatz_id: from.id,
    to_campingplatz_id: to.id,
    distance_km: est.distanceKm,
    duration_min: est.durationMinutes,
    provider: 'haversine',
    encoded_polyline: null,
    updated_at: new Date().toISOString(),
  }
  await setSegmentRoute(db, entry)
  return entry
}
