import { D1Database } from '@cloudflare/workers-types'
import {
  Campingplatz,
  CampingplatzRouteCacheEntry,
  getRouteForUserAndCampingplatz,
  setRouteForUserAndCampingplatz,
} from '@/lib/db'

const EARTH_RADIUS_KM = 6371

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

export async function callGoogleDistanceMatrix(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_DISTANCE_MATRIX_API_KEY
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

export async function calculateRouteWithCaching(params: {
  db: D1Database
  userId: string
  campingplatz: Campingplatz
  userLat: number
  userLng: number
}): Promise<CampingplatzRouteCacheEntry | null> {
  const { db, userId, campingplatz, userLat, userLng } = params

  const existing = await getRouteForUserAndCampingplatz(db, userId, campingplatz.id)
  if (existing) {
    return existing
  }

  if (campingplatz.lat != null && campingplatz.lng != null) {
    const fromGoogle = await callGoogleDistanceMatrix(
      { lat: userLat, lng: userLng },
      { lat: campingplatz.lat, lng: campingplatz.lng }
    )
    if (fromGoogle) {
      const entry: CampingplatzRouteCacheEntry = {
        user_id: userId,
        campingplatz_id: campingplatz.id,
        distance_km: fromGoogle.distanceKm,
        duration_min: fromGoogle.durationMinutes,
        provider: 'google',
        updated_at: new Date().toISOString(),
      }
      await setRouteForUserAndCampingplatz(db, entry)
      return entry
    }
  }

  if (campingplatz.lat != null && campingplatz.lng != null) {
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
      updated_at: new Date().toISOString(),
    }
    await setRouteForUserAndCampingplatz(db, entry)
    return entry
  }

  return null
}

