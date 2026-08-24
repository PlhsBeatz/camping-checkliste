import { hasArrivedAtCampingForSunCard, type GeoPoint } from '@/lib/sonnen-hub-arrival'
import {
  getRouteForUserAndCampingplatz,
  getSegmentRoute,
  type Rastplatz,
  type Vacation,
  type VacationCampingStay,
} from '@/lib/db'
import {
  GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP,
  getSegmentEmpfehlungsWaypoints,
  type RouteWaypoint,
} from '@/lib/maps-export'
import {
  buildReiseModusSegments,
  collectDisplayedTravelSegments,
  getSegmentTravelDayRange,
  getTravelSegmentRouteLookup,
  isReturnHomeSegment,
  polylineMatchFromRouteSource,
  type SegmentRouteMatch,
  type TravelSegment,
} from '@/lib/travel-segment'

export type HubTravelNavRouteMatch = SegmentRouteMatch

export type HubTravelNav = {
  label: string
  segment: TravelSegment
  waypoints: RouteWaypoint[]
}

function segmentPoint(segment: TravelSegment, end: 'from' | 'to'): GeoPoint {
  const p = segment[end]
  return { lat: p.lat, lng: p.lng }
}

/** Heutige Fahrt für den Hub: Kalendertag der Etappe, ausgeblendet nach Ankunft am Ziel. */
export function findHubTravelNav(opts: {
  vacation: Vacation
  stays: VacationCampingStay[]
  homeCoords: GeoPoint | null
  userPosition: GeoPoint | null
  todayYmd: string
}): HubTravelNav | null {
  const all = buildReiseModusSegments(opts.stays, opts.homeCoords)
  const returnSegment = all.find((s) => isReturnHomeSegment(s)) ?? null
  const travelSegments = all.filter((s) => !isReturnHomeSegment(s))
  const displayed = collectDisplayedTravelSegments(
    opts.stays,
    travelSegments,
    returnSegment
  )

  for (const segment of displayed) {
    const range = getSegmentTravelDayRange(segment, opts.vacation, opts.stays)
    if (!range) continue
    if (opts.todayYmd < range.startYmd || opts.todayYmd > range.endYmd) continue

    const destination = segmentPoint(segment, 'to')
    const origin = segmentPoint(segment, 'from')
    const originIsDest =
      destination.lat === origin.lat && destination.lng === origin.lng
    if (
      hasArrivedAtCampingForSunCard({
        destination,
        origin: originIsDest ? null : origin,
        user: opts.userPosition,
      })
    ) {
      continue
    }

    return { label: segment.label, segment, waypoints: [] }
  }

  return null
}

/** Cached Hin-/Rück- bzw. Etappen-Polyline; ohne Cache Luftlinien-Korridor. */
export async function loadTravelNavRouteMatch(
  db: D1Database,
  userId: string | undefined,
  segment: TravelSegment
): Promise<HubTravelNavRouteMatch> {
  const lookup = getTravelSegmentRouteLookup(segment)
  const fallback = polylineMatchFromRouteSource(lookup, null)

  if (lookup.kind === 'home') {
    if (!userId) return fallback
    const row = await getRouteForUserAndCampingplatz(db, userId, lookup.campingplatzId)
    return polylineMatchFromRouteSource(lookup, {
      encodedPolyline: row?.encoded_polyline,
      returnEncodedPolyline: row?.return_encoded_polyline,
      provider: row?.provider,
    })
  }

  if (lookup.kind === 'segment') {
    const row = await getSegmentRoute(db, lookup.fromId, lookup.toId)
    return polylineMatchFromRouteSource(lookup, {
      encodedPolyline: row?.encoded_polyline,
      provider: row?.provider,
    })
  }

  return fallback
}

export function attachTravelNavWaypoints(
  nav: HubTravelNav,
  rastplaetze: Rastplatz[],
  match?: HubTravelNavRouteMatch | null
): HubTravelNav {
  return {
    ...nav,
    waypoints: getSegmentEmpfehlungsWaypoints(
      nav.segment,
      rastplaetze,
      GOOGLE_MAPS_MAX_WAYPOINTS_DESKTOP,
      match?.encodedPolyline ?? null,
      match?.routeProvider ?? 'haversine'
    ),
  }
}
