import { haversineDistanceKm } from '@/lib/routes'

/** Fallback ohne echte Route (Luftlinie). */
export const ROUTE_STRAIGHT_CORRIDOR_KM = 20

/** Korridor entlang der echten Fahrstrecke (Autobahn-Rastplätze liegen meist < 3 km). */
export const ROUTE_POLYLINE_CORRIDOR_KM = 5

/** Puffer am Streckenanfang/-ende entlang der Route. */
export const ROUTE_ENDPOINT_BUFFER_KM = 3

/** Segmente kürzer als dieser Wert werden als Punkt behandelt (numerische Stabilität). */
const MIN_SEGMENT_LENGTH_KM = 0.05

/** Re-encodierte Step-Polylines waren >100k Zeichen und brachen den Filter. */
export const MAX_USABLE_POLYLINE_CHARS = 30_000

export type LatLng = { lat: number; lng: number }

const decodeCache = new Map<string, LatLng[]>()
const DECODE_CACHE_MAX = 32

function getCachedDecodedPolyline(encoded: string): LatLng[] {
  const cached = decodeCache.get(encoded)
  if (cached) return cached
  const points = decodeGooglePolyline(encoded)
  if (decodeCache.size >= DECODE_CACHE_MAX) {
    const first = decodeCache.keys().next().value
    if (first) decodeCache.delete(first)
  }
  decodeCache.set(encoded, points)
  return points
}

export function isUsableRoutePolyline(encoded: string | null | undefined): boolean {
  return !!encoded?.trim() && encoded.length <= MAX_USABLE_POLYLINE_CHARS
}

/** Heimat↔Platz-Cache: Hin- und Rück-Polyline (bei Google) nötig. */
export function isHomeRouteCacheComplete(
  entry:
    | {
        provider?: string | null
        encoded_polyline?: string | null
        return_encoded_polyline?: string | null
        encodedPolyline?: string | null
        returnEncodedPolyline?: string | null
        distance_km?: number | null
        distanceKm?: number | null
      }
    | null
    | undefined
): boolean {
  if (!entry) return false
  const provider = entry.provider
  const distance = entry.distance_km ?? entry.distanceKm
  const forward = entry.encoded_polyline ?? entry.encodedPolyline
  const reverse = entry.return_encoded_polyline ?? entry.returnEncodedPolyline
  if (provider === 'haversine') {
    return typeof distance === 'number' && distance >= 0
  }
  return isUsableRoutePolyline(forward) && isUsableRoutePolyline(reverse)
}

/** Google encoded polyline → Koordinatenliste. */
export function decodeGooglePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let shift = 0
    let result = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1
    lat += deltaLat

    shift = 0
    result = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1
    lng += deltaLng

    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }

  return points
}

/** Koordinatenliste → Google encoded polyline. */
export function encodeGooglePolyline(points: LatLng[]): string {
  let lastLat = 0
  let lastLng = 0
  let result = ''

  const encodeSigned = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63)
      v >>= 5
    }
    result += String.fromCharCode(v + 63)
  }

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5)
    const lng = Math.round(p.lng * 1e5)
    encodeSigned(lat - lastLat)
    encodeSigned(lng - lastLng)
    lastLat = lat
    lastLng = lng
  }

  return result
}

function sameCoord(a: LatLng, b: LatLng): boolean {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6
}

/** Dichte Polyline aus Directions-Schritten (genauer als overview_polyline). */
export function mergeDirectionsStepPoints(
  legs: Array<{ steps?: Array<{ polyline?: { points?: string } }> }> | undefined
): LatLng[] {
  const merged: LatLng[] = []
  for (const leg of legs ?? []) {
    for (const step of leg.steps ?? []) {
      const encoded = step.polyline?.points
      if (!encoded) continue
      for (const p of decodeGooglePolyline(encoded)) {
        const last = merged[merged.length - 1]
        if (last && sameCoord(last, p)) continue
        merged.push(p)
      }
    }
  }
  return merged
}

/** Stabiler Lotfußabstand Punkt–Strecke (equirectangular, km). */
function crossTrackWithParameter(
  point: LatLng,
  segStart: LatLng,
  segEnd: LatLng
): { crossKm: number; alongFromStartKm: number; segLenKm: number } {
  const segLenKm = haversineDistanceKm({
    lat1: segStart.lat,
    lng1: segStart.lng,
    lat2: segEnd.lat,
    lng2: segEnd.lng,
  })

  if (segLenKm < MIN_SEGMENT_LENGTH_KM) {
    const dStart = haversineDistanceKm({
      lat1: segStart.lat,
      lng1: segStart.lng,
      lat2: point.lat,
      lng2: point.lng,
    })
    const dEnd = haversineDistanceKm({
      lat1: segEnd.lat,
      lng1: segEnd.lng,
      lat2: point.lat,
      lng2: point.lng,
    })
    if (dStart <= dEnd) {
      return { crossKm: dStart, alongFromStartKm: 0, segLenKm }
    }
    return { crossKm: dEnd, alongFromStartKm: segLenKm, segLenKm }
  }

  const refLat = (segStart.lat + segEnd.lat) / 2
  const refLng = (segStart.lng + segEnd.lng) / 2
  const latRad = (refLat * Math.PI) / 180
  const kmPerDegLat = 110.54
  const kmPerDegLng = 111.32 * Math.cos(latRad)

  const toLocal = (p: LatLng) => ({
    x: (p.lng - refLng) * kmPerDegLng,
    y: (p.lat - refLat) * kmPerDegLat,
  })

  const a = toLocal(segStart)
  const b = toLocal(segEnd)
  const p = toLocal(point)
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abLenSq = abx * abx + aby * aby

  let t = 0
  if (abLenSq > 1e-12) {
    t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / abLenSq
    t = Math.max(0, Math.min(1, t))
  }

  const projX = a.x + t * abx
  const projY = a.y + t * aby
  const crossKm = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)

  return { crossKm, alongFromStartKm: t * segLenKm, segLenKm }
}

function polylineLengthKm(points: LatLng[]): number {
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineDistanceKm({
      lat1: points[i]!.lat,
      lng1: points[i]!.lng,
      lat2: points[i + 1]!.lat,
      lng2: points[i + 1]!.lng,
    })
  }
  return total
}

/** Liegt der Punkt im Korridor entlang der decodierten Routen-Polyline? */
export function isPointNearRoutePolyline(
  point: LatLng,
  polylinePoints: LatLng[],
  maxKm = ROUTE_POLYLINE_CORRIDOR_KM,
  endpointBufferKm = ROUTE_ENDPOINT_BUFFER_KM
): boolean {
  if (polylinePoints.length < 2) return false

  let minCross = Infinity
  let bestAlong = 0

  let cumulative = 0
  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const segStart = polylinePoints[i]!
    const segEnd = polylinePoints[i + 1]!
    const { crossKm, alongFromStartKm, segLenKm } = crossTrackWithParameter(point, segStart, segEnd)
    const alongRoute = cumulative + alongFromStartKm
    if (crossKm < minCross) {
      minCross = crossKm
      bestAlong = alongRoute
    }
    cumulative += segLenKm
  }

  if (minCross > maxKm) return false

  const totalLen = polylineLengthKm(polylinePoints)
  return (
    bestAlong <= totalLen + endpointBufferKm && bestAlong >= -endpointBufferKm
  )
}

export function isPointNearEncodedPolyline(
  point: LatLng,
  encodedPolyline: string | null | undefined,
  maxKm = ROUTE_POLYLINE_CORRIDOR_KM
): boolean {
  if (!isUsableRoutePolyline(encodedPolyline)) return false
  try {
    const points = getCachedDecodedPolyline(encodedPolyline!)
    return isPointNearRoutePolyline(point, points, maxKm)
  } catch {
    return false
  }
}

/** Punkt nahe mindestens einer der Polylines (z. B. Hin- und Rückroute Heimat↔Platz). */
export function isPointNearAnyEncodedPolyline(
  point: LatLng,
  encodedPolylines: Array<string | null | undefined>,
  maxKm = ROUTE_POLYLINE_CORRIDOR_KM
): boolean {
  for (const encoded of encodedPolylines) {
    if (isPointNearEncodedPolyline(point, encoded, maxKm)) return true
  }
  return false
}
