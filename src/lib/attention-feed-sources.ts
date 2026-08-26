import {
  getCampingStaysForVacation,
  getChecklistenHubSummaries,
  getOptimierungen,
  getPackingItemsForHub,
  getPackStatus,
  getRastplaetzeForHub,
  getUserById,
  getVacations,
  type PackingItem,
  type PackStatusData,
  type Rastplatz,
  type VacationCampingStay,
} from '@/lib/db'
import { getFaelligkeitenForHub } from '@/lib/db-wartung'
import { getAttentionSnoozes } from '@/lib/db-attention'
import { findCurrentOrNextVacation, type AttentionFeedInput } from '@/lib/attention-feed'
import { findRelevantVacation } from '@/lib/trip-readiness'
import { parseGeoPoint, type GeoPoint } from '@/lib/sonnen-hub-arrival'
import { todayInAppTimezone } from '@/lib/app-timezone'
import {
  findHubTravelNav,
  loadTravelNavRouteMatch,
  type HubTravelNavRouteMatch,
} from '@/lib/hub-travel-nav'

export async function loadAttentionFeedInput(
  db: D1Database,
  opts: {
    includeAdminItems: boolean
    includeWartungItems: boolean
    includeOptimierungItems: boolean
    mitreisenderFilter?: string
    snoozes?: Map<string, string>
    userId?: string
    userPosition?: GeoPoint | null
    /** Nur Badge-Zahl: ohne Rastplätze, Routen-Polyline und Campingplatz-Aufenthalte. */
    mode?: 'full' | 'count'
  }
): Promise<AttentionFeedInput> {
  const full = opts.mode !== 'count'
  const vacations = await getVacations(db, opts.mitreisenderFilter)
  const relevant = findRelevantVacation(vacations)
  const hubVacation = findCurrentOrNextVacation(vacations)
  const sameHub = !!relevant && !!hubVacation && relevant.id === hubVacation.id

  const [
    packingItems,
    packStatus,
    hubPackingExtra,
    hubStatusExtra,
    campingStays,
    faelligkeiten,
    checklisten,
    snoozes,
    user,
    optimierungen,
  ] = await Promise.all([
    relevant ? getPackingItemsForHub(db, relevant.id) : Promise.resolve<PackingItem[]>([]),
    relevant ? getPackStatus(db, relevant.id) : Promise.resolve<PackStatusData | null>(null),
    full && hubVacation && !sameHub
      ? getPackingItemsForHub(db, hubVacation.id)
      : Promise.resolve<PackingItem[] | null>(null),
    full && hubVacation && !sameHub
      ? getPackStatus(db, hubVacation.id)
      : Promise.resolve<PackStatusData | null>(null),
    full && hubVacation
      ? getCampingStaysForVacation(db, hubVacation.id)
      : Promise.resolve<VacationCampingStay[]>([]),
    opts.includeWartungItems ? getFaelligkeitenForHub(db) : Promise.resolve([]),
    getChecklistenHubSummaries(db),
    opts.snoozes ? Promise.resolve(opts.snoozes) : getAttentionSnoozes(db),
    full && opts.userId ? getUserById(db, opts.userId) : Promise.resolve(null),
    opts.includeOptimierungItems
      ? getOptimierungen(db, undefined, { relations: false })
      : Promise.resolve([]),
  ])

  const homeCoords = user ? parseGeoPoint(user.heimat_lat, user.heimat_lng) : null

  let travelNavRastplaetze: Rastplatz[] = []
  let travelNavRouteMatch: HubTravelNavRouteMatch | null = null
  if (full && hubVacation) {
    const hint = findHubTravelNav({
      vacation: hubVacation,
      stays: campingStays,
      homeCoords,
      userPosition: opts.userPosition ?? null,
      todayYmd: todayInAppTimezone(),
    })
    if (hint) {
      const [rast, match] = await Promise.all([
        getRastplaetzeForHub(db),
        loadTravelNavRouteMatch(db, opts.userId, hint.segment),
      ])
      travelNavRastplaetze = rast
      travelNavRouteMatch = match
    }
  }

  return {
    vacations,
    packingItems,
    packStatus,
    hubPackingItems: sameHub || !hubVacation ? packingItems : (hubPackingExtra ?? []),
    hubPackStatus: sameHub || !hubVacation ? packStatus : hubStatusExtra,
    campingStays,
    userPosition: opts.userPosition ?? null,
    homeCoords,
    travelNavRastplaetze,
    travelNavRouteMatch,
    faelligkeiten,
    optimierungen,
    checklisten,
    snoozes,
    includeAdminItems: opts.includeAdminItems,
    includeWartungItems: opts.includeWartungItems,
    includeOptimierungItems: opts.includeOptimierungItems,
    includeTravelNav: full,
  }
}
