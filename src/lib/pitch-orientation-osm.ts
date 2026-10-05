/**
 * Parzellen-Ausrichtung aus OSM-Wegen (Overpass): Zufahrten, Pfade, Hecken.
 * Reine Geometrie – läuft Client und Server.
 *
 * Längsachse parallel zu Hecken/Zufahrt (Camping-Reihen).
 * Polarität: Tür (rechts vom Bug) zeigt zur nächsten Zufahrt.
 */
import { normalizeHeadingDeg } from '@/lib/caravan-geometry'
import type { PitchOrientationResult } from '@/lib/pitch-orientation-types'

export type OsmWayGeom = {
  type?: string
  id?: number
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

export type OsmOverpassResponse = {
  elements?: OsmWayGeom[]
}

const METERS_PER_DEG_LAT = 111_320

function metersBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const cosLat = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  const dLat = (lat2 - lat1) * METERS_PER_DEG_LAT
  const dLng =
    (lng2 - lng1) * METERS_PER_DEG_LAT * Math.max(Math.abs(cosLat), 0.01)
  return Math.hypot(dLat, dLng)
}

function bearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const cosLat = Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  const east =
    (lng2 - lng1) * METERS_PER_DEG_LAT * Math.max(Math.abs(cosLat), 0.01)
  const north = (lat2 - lat1) * METERS_PER_DEG_LAT
  return normalizeHeadingDeg((Math.atan2(east, north) * 180) / Math.PI)
}

function distPointToSegmentM(
  lat: number,
  lng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): { distM: number; closestLat: number; closestLng: number } {
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const ax = (aLng - lng) * METERS_PER_DEG_LAT * Math.max(Math.abs(cosLat), 0.01)
  const ay = (aLat - lat) * METERS_PER_DEG_LAT
  const bx = (bLng - lng) * METERS_PER_DEG_LAT * Math.max(Math.abs(cosLat), 0.01)
  const by = (bLat - lat) * METERS_PER_DEG_LAT
  const abx = bx - ax
  const aby = by - ay
  const ab2 = abx * abx + aby * aby
  let t = ab2 > 1e-9 ? (-ax * abx - ay * aby) / ab2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * abx
  const cy = ay + t * aby
  return {
    distM: Math.hypot(cx, cy),
    closestLat: lat + cy / METERS_PER_DEG_LAT,
    closestLng:
      lng + cx / (METERS_PER_DEG_LAT * Math.max(Math.abs(cosLat), 0.01)),
  }
}

function isAccessWay(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false
  const hw = tags.highway
  if (!hw) return false
  return /^(service|path|footway|track|residential|unclassified|living_street|pedestrian|cycleway)$/i.test(
    hw
  )
}

function isBoundaryWay(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false
  const barrier = tags.barrier
  if (barrier && /^(hedge|fence|wall|retaining_wall|kerb)$/i.test(barrier)) {
    return true
  }
  if (tags.natural === 'tree_row' || tags.natural === 'hedge') return true
  return false
}

function segmentWeight(
  distM: number,
  lengthM: number,
  kind: 'access' | 'boundary'
): number {
  const proximity = 1 / (1 + distM / 8)
  const len = Math.min(lengthM, 40)
  const kindBoost = kind === 'boundary' ? 1.4 : 1
  return proximity * len * kindBoost
}

function undirectedDelta(a: number, b: number): number {
  const d = Math.abs(((a % 180) + 180) % 180 - (((b % 180) + 180) % 180))
  return Math.min(d, 180 - d)
}

function smoothBin(bins: Float64Array, i: number): number {
  return (
    bins[(i + 179) % 180]! * 0.25 + bins[i]! * 0.5 + bins[(i + 1) % 180]! * 0.25
  )
}

function findRectilinearAxes(bins: Float64Array): {
  primary: { deg: number; val: number }
  ortho: { deg: number; val: number }
  mass: number
} | null {
  let mass = 0
  for (let i = 0; i < 180; i++) mass += bins[i]!
  if (mass < 6) return null

  let bestI = 0
  let bestV = 0
  for (let i = 0; i < 180; i++) {
    const v = smoothBin(bins, i)
    if (v > bestV) {
      bestV = v
      bestI = i
    }
  }

  let orthoI = (bestI + 90) % 180
  let orthoV = 0
  for (let d = -20; d <= 20; d++) {
    const i = (bestI + 90 + d + 180) % 180
    const v = smoothBin(bins, i)
    if (v > orthoV) {
      orthoV = v
      orthoI = i
    }
  }

  return {
    primary: { deg: bestI, val: bestV },
    ortho: { deg: orthoI, val: orthoV },
    mass,
  }
}

function snapToAxis(heading: number, lineDeg: number): number {
  const a = lineDeg
  const b = normalizeHeadingDeg(lineDeg + 180)
  const da = Math.abs(((heading - a + 540) % 360) - 180)
  const db = Math.abs(((heading - b + 540) % 360) - 180)
  return da <= db ? a : b
}

/**
 * Schätzt Ausrichtung aus Overpass-Elementen.
 * Längsachse ∥ Hecken/Zufahrt; Tür (rechts vom Bug) zur Zufahrt.
 */
export function estimateOrientationFromOsmWays(
  lat: number,
  lng: number,
  elements: OsmWayGeom[],
  radiusM = 50
): PitchOrientationResult | null {
  const accessBins = new Float64Array(180)
  const boundaryBins = new Float64Array(180)
  let nearestAccess: {
    distM: number
    closestLat: number
    closestLng: number
  } | null = null

  for (const el of elements) {
    const geom = el.geometry
    if (!geom || geom.length < 2) continue
    const access = isAccessWay(el.tags)
    const boundary = isBoundaryWay(el.tags)
    if (!access && !boundary) continue

    for (let i = 0; i < geom.length - 1; i++) {
      const a = geom[i]!
      const b = geom[i + 1]!
      const lengthM = metersBetween(a.lat, a.lon, b.lat, b.lon)
      if (lengthM < 0.4) continue
      const closest = distPointToSegmentM(lat, lng, a.lat, a.lon, b.lat, b.lon)
      if (closest.distM > radiusM) continue

      const lineBearing = bearingDeg(a.lat, a.lon, b.lat, b.lon) % 180
      const bin = Math.floor(lineBearing) % 180

      if (access) {
        const w = segmentWeight(closest.distM, lengthM, 'access')
        accessBins[bin]! += w
        if (!nearestAccess || closest.distM < nearestAccess.distM) {
          nearestAccess = closest
        }
      }
      if (boundary) {
        const w = segmentWeight(closest.distM, lengthM, 'boundary')
        boundaryBins[bin]! += w
      }
    }
  }

  const boundaryAxes = findRectilinearAxes(boundaryBins)
  const accessAxes = findRectilinearAxes(accessBins)

  // Längsachse: Hecken bevorzugen; sonst parallel zur Zufahrt (Reihen-Camping)
  let lineDeg: number | null = null
  if (boundaryAxes) {
    const { primary, ortho } = boundaryAxes
    lineDeg = primary.deg
    // Zufahrt parallel zu einer Hecken-Achse → diese Achse (nicht 45°-Kompromiss)
    if (accessAxes) {
      const road = accessAxes.primary.deg
      if (undirectedDelta(primary.deg, road) <= 28) lineDeg = primary.deg
      else if (undirectedDelta(ortho.deg, road) <= 28) lineDeg = ortho.deg
      else if (ortho.val >= primary.val * 0.9) {
        // Beide Hecken stark: Achse parallel zur nächsten Zufahrts-Tangente
        if (nearestAccess) {
          const toRoad = bearingDeg(
            lat,
            lng,
            nearestAccess.closestLat,
            nearestAccess.closestLng
          )
          // Tangente zur Zufahrt ≈ toRoad + 90
          const alongRoad = (toRoad + 90) % 180
          lineDeg =
            undirectedDelta(ortho.deg, alongRoad) <
            undirectedDelta(primary.deg, alongRoad)
              ? ortho.deg
              : primary.deg
        }
      }
    }
  } else if (accessAxes) {
    lineDeg = accessAxes.primary.deg
  }

  if (lineDeg == null && !nearestAccess) return null
  if (lineDeg == null) lineDeg = 0

  let headingDeg: number
  if (nearestAccess) {
    // Tür rechts vom Bug soll zur Zufahrt zeigen → Bug = toRoad − 90°
    const toRoad = bearingDeg(
      lat,
      lng,
      nearestAccess.closestLat,
      nearestAccess.closestLng
    )
    headingDeg = normalizeHeadingDeg(toRoad - 90)
    headingDeg = snapToAxis(headingDeg, lineDeg)
  } else {
    headingDeg = lineDeg
  }

  const peak = boundaryAxes ?? accessAxes
  const peakRatio = peak
    ? peak.primary.val / Math.max(peak.ortho.val, 0.01)
    : 1
  const isGrid = peak != null && peak.ortho.val / peak.primary.val >= 0.55
  const confFromPeak = isGrid
    ? 0.55
    : Math.min(1, Math.max(0.28, (peakRatio - 1) / 1.2 + 0.3))
  const confFromRoad = nearestAccess
    ? Math.min(1, 0.4 + (1 - Math.min(nearestAccess.distM, 40) / 40) * 0.45)
    : 0.3
  const confidence = Math.min(
    1,
    Math.max(confFromPeak, confFromRoad) * (boundaryAxes ? 1.08 : 1)
  )

  return {
    headingDeg,
    confidence,
    lineDeg,
    source: 'osm',
    detail: isGrid ? 'grid' : 'mono',
  }
}

export function buildPitchOverpassQuery(
  lat: number,
  lng: number,
  radiusM = 55
): string {
  const r = Math.round(radiusM)
  return `
[out:json][timeout:12];
(
  way(around:${r},${lat},${lng})["highway"~"^(service|path|footway|track|residential|unclassified|living_street|pedestrian|cycleway)$"];
  way(around:${r},${lat},${lng})["barrier"~"^(hedge|fence|wall|retaining_wall|kerb)$"];
  way(around:${r},${lat},${lng})["natural"~"^(tree_row|hedge)$"];
);
out geom;
`.trim()
}

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
] as const
