import type { ApiResponse } from '@/lib/api-types'
import {
  cacheEntryToRouteInfo,
  parseCampingplatzRouteApiData,
  segmentCacheEntryToRouteInfo,
  type CampingplatzRouteInfo,
} from '@/lib/client-route-info'
import type { HubTravelNav } from '@/lib/hub-travel-nav'
import type { Rastplatz } from '@/lib/db'
import {
  ADAC_MAX_WAYPOINTS,
  googleMapsWaypointLimit,
  openAdacMapsRoute,
  openGoogleMapsRoute,
  getSegmentEmpfehlungsWaypoints,
} from '@/lib/maps-export'
import { getCachedAuthUser, getCachedRastplaetze, getCachedRoute, getCachedSegmentRoute } from '@/lib/offline-sync'
import {
  getTravelSegmentRouteLookup,
  polylineMatchFromRouteSource,
  type SegmentRouteMatch,
  type SegmentPolylineSource,
  type TravelSegment,
  type TravelSegmentRouteLookup,
} from '@/lib/travel-segment'

async function loadRastplaetze(): Promise<Rastplatz[]> {
  try {
    const res = await fetch('/api/rastplaetze')
    const json = (await res.json()) as ApiResponse<Rastplatz[]>
    if (json.success && Array.isArray(json.data)) return json.data
  } catch {
    /* Offline: Cache */
  }
  return getCachedRastplaetze().catch(() => [])
}

async function fetchCampingplatzRoute(
  campingplatzId: string
): Promise<CampingplatzRouteInfo | null> {
  const res = await fetch('/api/routes/campingplatz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campingplatzId }),
  })
  const json = (await res.json()) as ApiResponse<CampingplatzRouteInfo>
  return parseCampingplatzRouteApiData(json.data)
}

async function fetchSegmentRoute(
  fromId: string,
  toId: string
): Promise<CampingplatzRouteInfo | null> {
  const res = await fetch('/api/routes/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromId, toId }),
  })
  const json = (await res.json()) as ApiResponse<CampingplatzRouteInfo>
  return parseCampingplatzRouteApiData(json.data)
}

async function loadCachedRouteSource(
  lookup: TravelSegmentRouteLookup
): Promise<SegmentPolylineSource | null> {
  if (lookup.kind === 'home') {
    const user = await getCachedAuthUser().catch(() => null)
    if (!user?.id) return null
    const cached = await getCachedRoute(user.id, lookup.campingplatzId).catch(() => null)
    return cached ? cacheEntryToRouteInfo(cached) : null
  }
  if (lookup.kind === 'segment') {
    const cached = await getCachedSegmentRoute(lookup.fromId, lookup.toId).catch(() => null)
    return cached ? segmentCacheEntryToRouteInfo(cached) : null
  }
  return null
}

/** Dieselbe Route-Zuordnung wie auf der Urlaubsseite, inkl. Offline-Cache. */
async function loadSegmentRouteMatch(segment: TravelSegment): Promise<SegmentRouteMatch> {
  const lookup = getTravelSegmentRouteLookup(segment)
  const fallback = polylineMatchFromRouteSource(lookup, null)

  try {
    const cached = await loadCachedRouteSource(lookup)
    const cachedMatch = polylineMatchFromRouteSource(lookup, cached)
    if (cachedMatch.encodedPolyline) return cachedMatch

    if (lookup.kind === 'home') {
      return polylineMatchFromRouteSource(
        lookup,
        await fetchCampingplatzRoute(lookup.campingplatzId)
      )
    }
    if (lookup.kind === 'segment') {
      return polylineMatchFromRouteSource(
        lookup,
        await fetchSegmentRoute(lookup.fromId, lookup.toId)
      )
    }
  } catch {
    /* Cache / Netz */
  }

  return fallback
}

export async function openHeuteTravelNav(
  nav: HubTravelNav,
  provider: 'google' | 'adac'
): Promise<void> {
  const maxWaypoints =
    provider === 'google' ? googleMapsWaypointLimit() : ADAC_MAX_WAYPOINTS
  const [rastplaetze, match] = await Promise.all([
    loadRastplaetze(),
    loadSegmentRouteMatch(nav.segment),
  ])
  const live = getSegmentEmpfehlungsWaypoints(
    nav.segment,
    rastplaetze,
    maxWaypoints,
    match.encodedPolyline,
    match.routeProvider
  )
  const waypoints = live.length > 0 ? live : nav.waypoints
  if (provider === 'google') {
    openGoogleMapsRoute(nav.segment, waypoints, maxWaypoints)
    return
  }
  openAdacMapsRoute(nav.segment, waypoints, maxWaypoints)
}
