import {
  getCampingStaysForVacation,
  getChecklistenFullTree,
  getOptimierungen,
  getPackingItems,
  getPackStatus,
  getRastplaetze,
  getUserById,
  getVacations,
  type PackingItem,
  type PackStatusData,
  type Rastplatz,
  type VacationCampingStay,
} from '@/lib/db'
import { getFaelligkeiten } from '@/lib/db-wartung'
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
  }
): Promise<AttentionFeedInput> {
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
  ] = await Promise.all([
    relevant ? getPackingItems(db, relevant.id) : Promise.resolve<PackingItem[]>([]),
    relevant ? getPackStatus(db, relevant.id) : Promise.resolve<PackStatusData | null>(null),
    hubVacation && !sameHub
      ? getPackingItems(db, hubVacation.id)
      : Promise.resolve<PackingItem[] | null>(null),
    hubVacation && !sameHub
      ? getPackStatus(db, hubVacation.id)
      : Promise.resolve<PackStatusData | null>(null),
    hubVacation
      ? getCampingStaysForVacation(db, hubVacation.id)
      : Promise.resolve<VacationCampingStay[]>([]),
    opts.includeWartungItems ? getFaelligkeiten(db) : Promise.resolve([]),
    getChecklistenFullTree(db),
    opts.snoozes ? Promise.resolve(opts.snoozes) : getAttentionSnoozes(db),
    opts.userId ? getUserById(db, opts.userId) : Promise.resolve(null),
  ])

  const optimierungen = opts.includeOptimierungItems ? await getOptimierungen(db) : []
  const homeCoords = user ? parseGeoPoint(user.heimat_lat, user.heimat_lng) : null

  let travelNavRastplaetze: Rastplatz[] = []
  let travelNavRouteMatch: HubTravelNavRouteMatch | null = null
  if (hubVacation) {
    const hint = findHubTravelNav({
      vacation: hubVacation,
      stays: campingStays,
      homeCoords,
      userPosition: opts.userPosition ?? null,
      todayYmd: todayInAppTimezone(),
    })
    if (hint) {
      const [rast, match] = await Promise.all([
        getRastplaetze(db),
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
  }
}
