import { buildAdacRouteUrl, formatAdacPlace, openPlaceInAdacMaps } from '@/lib/adac-maps'
import type { Rastplatz } from '@/lib/db'
import { haversineDistanceKm } from '@/lib/routes'
import { isPointNearAnyEncodedPolyline } from '@/lib/route-polyline'
import { isPointInSegmentCorridor, type TravelSegment } from '@/lib/travel-segment'

export const GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP = 9
export const GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE = 3
export const ADAC_MAX_WAYPOINTS = 5

export function googleMapsWaypointLimit(): number {
  if (typeof window !== 'undefined' && window.innerWidth < 768) {
    return GOOGLE_MAPS_MAX_WAYPOINTS_MOBILE
  }
  return GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP
}

export type RouteWaypoint = {
  lat: number
  lng: number
  label?: string
  googlePlaceId?: string | null
}

/** Koordinaten — Ortsnamen wie „Zuhause“ geocodiert Google Maps am Desktop nicht zuverlässig. */
function formatLatLng(w: RouteWaypoint): string {
  return `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`
}

/** Google Maps Directions URL mit Zwischenzielen (max. 9 Desktop, 3 Mobile). */
export function buildGoogleMapsRouteUrl(params: {
  origin: RouteWaypoint
  destination: RouteWaypoint
  waypoints?: RouteWaypoint[]
  travelMode?: 'driving' | 'walking' | 'bicycling'
}): string {
  const hops = [params.origin, ...(params.waypoints ?? []), params.destination]
  const path = hops.map(formatLatLng).join('/')
  void params.travelMode
  return `https://www.google.com/maps/dir/${path}`
}

/** ADAC-Route mit mehreren Zwischenzielen (Gespann). */
export function buildAdacRouteUrlWithWaypoints(params: {
  origin: RouteWaypoint
  destination: RouteWaypoint
  waypoints?: RouteWaypoint[]
  departure?: Date
}): string {
  /** Typ 2 entspricht dem aktuellen ADAC-Routenplaner (Start, Zwischenziel, Ziel). */
  const toPlace = (w: RouteWaypoint) => formatAdacPlace(w.lat, w.lng, 2)
  const parts = [
    toPlace(params.origin),
    ...(params.waypoints ?? []).map(toPlace),
    toPlace(params.destination),
  ]
  return buildAdacRouteUrl(parts.join(','), params.departure)
}

export type SegmentRouteMatchOptions = {
  encodedPolyline?: string | null
  /** Zusätzliche Polylines (z. B. Hinfahrt bei Roundtrip zum selben Platz). */
  alternateEncodedPolylines?: Array<string | null | undefined>
  routeProvider?: 'google' | 'haversine' | null
}

export function isRastplatzOnTravelSegment(
  r: Rastplatz,
  segment: TravelSegment,
  match?: SegmentRouteMatchOptions | string | null
): boolean {
  if (r.is_archived || r.lat == null || r.lng == null) return false
  const point = { lat: r.lat, lng: r.lng }
  const options: SegmentRouteMatchOptions =
    typeof match === 'string' || match === null || match === undefined
      ? { encodedPolyline: match }
      : match

  const polylines = [
    options.encodedPolyline,
    ...(options.alternateEncodedPolylines ?? []),
  ].filter((p): p is string => !!p?.trim())

  if (polylines.length > 0) {
    return isPointNearAnyEncodedPolyline(point, polylines)
  }
  if (options.routeProvider === 'haversine') {
    return isPointInSegmentCorridor(point, segment.from, segment.to)
  }
  return false
}

export function getRastplaetzeAlongSegment(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  match?: SegmentRouteMatchOptions | string | null
): Rastplatz[] {
  return rastplaetze.filter((r) => isRastplatzOnTravelSegment(r, segment, match))
}

/** Empfehlungen entlang eines Segments als Wegpunkte (sortiert von Start nach Ziel). */
export function selectRastplaetzeForSegment(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  options?: {
    onlyEmpfehlung?: boolean
    maxCount?: number
    encodedPolyline?: string | null
    routeProvider?: 'google' | 'haversine' | null
  }
): Rastplatz[] {
  const onlyEmpfehlung = options?.onlyEmpfehlung !== false
  const maxCount = options?.maxCount ?? 9
  const along = getRastplaetzeAlongSegment(segment, rastplaetze, {
    encodedPolyline: options?.encodedPolyline,
    routeProvider: options?.routeProvider,
  })
  const filtered = onlyEmpfehlung
    ? along.filter((r) => r.bewertung === 'empfehlung')
    : along

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
  maxCount: number,
  encodedPolyline?: string | null,
  routeProvider?: 'google' | 'haversine' | null
): RouteWaypoint[] {
  return selectRastplaetzeForSegment(segment, rastplaetze, {
    maxCount,
    encodedPolyline,
    routeProvider,
  }).map(rastplatzToWaypoint)
}

export function countSegmentEmpfehlungen(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  match?: { encodedPolyline?: string | null; routeProvider?: 'google' | 'haversine' | null }
): number {
  return selectRastplaetzeForSegment(segment, rastplaetze, {
    maxCount: 999,
    encodedPolyline: match?.encodedPolyline,
    routeProvider: match?.routeProvider,
  }).length
}

export function openGoogleMapsRoute(
  segment: TravelSegment,
  waypoints: RouteWaypoint[],
  maxWaypoints = GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP
): void {
  const { origin, destination } = segmentRouteEndpoints(segment)
  window.open(
    buildGoogleMapsRouteUrl({
      origin,
      destination,
      waypoints: waypoints.slice(0, maxWaypoints),
    }),
    '_blank'
  )
}

export function openAdacMapsRoute(
  segment: TravelSegment,
  waypoints: RouteWaypoint[],
  maxWaypoints = ADAC_MAX_WAYPOINTS
): void {
  const { origin, destination } = segmentRouteEndpoints(segment)
  window.open(
    buildAdacRouteUrlWithWaypoints({
      origin,
      destination,
      waypoints: waypoints.slice(0, maxWaypoints),
    }),
    '_blank'
  )
}

export function openSegmentInGoogleMaps(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  maxWaypoints = GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP,
  encodedPolyline?: string | null,
  routeProvider?: 'google' | 'haversine' | null
): void {
  openGoogleMapsRoute(
    segment,
    getSegmentEmpfehlungsWaypoints(
      segment,
      rastplaetze,
      maxWaypoints,
      encodedPolyline,
      routeProvider
    ),
    maxWaypoints
  )
}

export function openSegmentInAdacMaps(
  segment: TravelSegment,
  rastplaetze: Rastplatz[],
  maxWaypoints = ADAC_MAX_WAYPOINTS,
  encodedPolyline?: string | null,
  routeProvider?: 'google' | 'haversine' | null
): void {
  openAdacMapsRoute(
    segment,
    getSegmentEmpfehlungsWaypoints(
      segment,
      rastplaetze,
      maxWaypoints,
      encodedPolyline,
      routeProvider
    ),
    maxWaypoints
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
