import { buildAdacRouteUrl, formatAdacPlace, openPlaceInAdacMaps } from '@/lib/adac-maps'
import type { Rastplatz } from '@/lib/db'
import { haversineDistanceKm } from '@/lib/routes'
import { isPointInSegmentCorridor, type TravelSegment } from '@/lib/travel-segment'

export const GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP = 9
export const GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE = 3
export const ADAC_MAX_WAYPOINTS = 5

export type RouteWaypoint = {
  lat: number
  lng: number
  label?: string
  googlePlaceId?: string | null
}

/** Google Maps Directions URL mit Zwischenzielen (max. 9 Desktop, 3 Mobile). */
export function buildGoogleMapsRouteUrl(params: {
  origin: RouteWaypoint
  destination: RouteWaypoint
  waypoints?: RouteWaypoint[]
  travelMode?: 'driving' | 'walking' | 'bicycling'
}): string {
  const fmt = (w: RouteWaypoint) =>
    w.label?.trim()
      ? w.label.trim()
      : `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`

  const search = new URLSearchParams({
    api: '1',
    origin: fmt(params.origin),
    destination: fmt(params.destination),
    travelmode: params.travelMode ?? 'driving',
  })

  const wps = params.waypoints ?? []
  if (wps.length > 0) {
    search.set('waypoints', wps.map(fmt).join('|'))
    const placeIds = wps.map((w) => w.googlePlaceId).filter(Boolean) as string[]
    if (placeIds.length === wps.length && placeIds.length > 0) {
      search.set('waypoint_place_ids', placeIds.join('|'))
    }
  }

  return `https://www.google.com/maps/dir/?${search.toString()}`
}

/** ADAC-Route mit mehreren Zwischenzielen (Gespann). */
export function buildAdacRouteUrlWithWaypoints(params: {
  origin: RouteWaypoint
  destination: RouteWaypoint
  waypoints?: RouteWaypoint[]
  departure?: Date
}): string {
  const toPlace = (w: RouteWaypoint, type: 1 | 6 = 6) =>
    formatAdacPlace(w.lat, w.lng, type)

  const parts = [
    toPlace(params.origin, 1),
    ...(params.waypoints ?? []).map((w) => toPlace(w, 6)),
    toPlace(params.destination, 6),
  ]
  return buildAdacRouteUrl(parts.join(','), params.departure)
}

/** Empfehlungen entlang eines Segments als Wegpunkte (sortiert von Start nach Ziel). */
export function selectRastplaetzeForSegment(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  options?: { onlyEmpfehlung?: boolean; maxCount?: number }
): Rastplatz[] {
  const onlyEmpfehlung = options?.onlyEmpfehlung !== false
  const maxCount = options?.maxCount ?? 9
  const filtered = rastplaetze.filter((r) => {
    if (r.is_archived) return false
    if (onlyEmpfehlung && r.bewertung !== 'empfehlung') return false
    if (r.lat == null || r.lng == null) return false
    return isPointInSegmentCorridor(
      { lat: r.lat, lng: r.lng },
      segment.from,
      segment.to
    )
  })

  const scored = filtered
    .map((r) => {
      const dFrom = haversineDistanceKm({
        lat1: segment.from.lat,
        lng1: segment.from.lng,
        lat2: r.lat!,
        lng2: r.lng!,
      })
      return { r, dFrom }
    })
    .sort((a, b) => a.dFrom - b.dFrom)
    .slice(0, maxCount)
    .map((x) => x.r)

  return scored
}

function segmentRouteEndpoints(segment: TravelSegment): {
  origin: RouteWaypoint
  destination: RouteWaypoint
} {
  return {
    origin: {
      lat: segment.from.lat,
      lng: segment.from.lng,
      label: segment.from.label,
    },
    destination: {
      lat: segment.to.lat,
      lng: segment.to.lng,
      label: segment.to.label,
    },
  }
}

export function getSegmentEmpfehlungsWaypoints(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  maxCount: number
): RouteWaypoint[] {
  return selectRastplaetzeForSegment(segment, rastplaetze, { maxCount }).map(rastplatzToWaypoint)
}

export function countSegmentEmpfehlungen(
  segment: TravelSegment,
  rastplaetze: Rastplatz[]
): number {
  return selectRastplaetzeForSegment(segment, rastplaetze, { maxCount: 999 }).length
}

export function openSegmentInGoogleMaps(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  maxWaypoints = GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP
): void {
  const { origin, destination } = segmentRouteEndpoints(segment)
  const waypoints = getSegmentEmpfehlungsWaypoints(segment, rastplaetze, maxWaypoints)
  window.open(
    buildGoogleMapsRouteUrl({ origin, destination, waypoints }),
    '_blank'
  )
}

export function openSegmentInAdacMaps(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  maxWaypoints = ADAC_MAX_WAYPOINTS
): void {
  const { origin, destination } = segmentRouteEndpoints(segment)
  const waypoints = getSegmentEmpfehlungsWaypoints(segment, rastplaetze, maxWaypoints)
  window.open(
    buildAdacRouteUrlWithWaypoints({ origin, destination, waypoints }),
    '_blank'
  )
}

export function rastplatzToWaypoint(r: Rastplatz): RouteWaypoint {
  return {
    lat: r.lat!,
    lng: r.lng!,
    label: r.name,
    googlePlaceId: r.google_place_id,
  }
}

/** GPX-Wegpunkte für Export (Garmin, OsmAnd). */
export function buildGpxWaypoints(rastplaetze: Rastplatz[], routeName = 'Rastplätze'): string {
  const wpts = rastplaetze
    .filter((r) => r.lat != null && r.lng != null && !r.is_archived)
    .map(
      (r) =>
        `  <wpt lat="${r.lat}" lon="${r.lng}">
    <name>${escapeXml(r.name)}</name>
    <desc>${escapeXml(r.bewertung === 'empfehlung' ? 'Empfehlung' : 'No-Go')}${r.bemerkungen ? ' – ' + r.bemerkungen : ''}</desc>
  </wpt>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Camping-Packliste">
  <metadata><name>${escapeXml(routeName)}</name></metadata>
${wpts}
</gpx>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadGpx(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildGoogleMapsPlaceUrl(r: Pick<Rastplatz, 'name' | 'lat' | 'lng' | 'adresse' | 'google_place_id'>): string {
  const params = new URLSearchParams({ api: '1' })
  const label =
    r.name?.trim() ||
    r.adresse?.trim() ||
    (r.lat != null && r.lng != null ? `${r.lat},${r.lng}` : '')
  if (label) params.set('query', label)
  if (r.google_place_id) params.set('query_place_id', r.google_place_id)
  if (!label && !r.google_place_id && r.lat != null && r.lng != null) {
    params.set('query', `${r.lat},${r.lng}`)
  }
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export function openRastplatzInGoogleMaps(r: Rastplatz): void {
  if (r.lat == null || r.lng == null) return
  window.open(buildGoogleMapsPlaceUrl(r), '_blank')
}

export async function openRastplatzInAdac(r: Rastplatz): Promise<void> {
  if (r.lat == null || r.lng == null) return
  await openPlaceInAdacMaps({
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    ort: r.ort,
    land: r.land,
    adresse: r.adresse,
  })
}
