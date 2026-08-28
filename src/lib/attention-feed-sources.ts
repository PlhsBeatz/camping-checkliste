import {
  getCampingStaysForVacation,
  getChecklistenHubSummaries,
  getOptimierungen,
  getPackingItemsForHub,
  getPackStatus,
  getRastplaetzeForHub,
  getRestzahlungAttentionStays,
  getUserById,
  getVacations,
  type PackingItem,
  type PackStatusData,
  type Rastplatz,
  type RestzahlungAttentionStay,
  type Vacation,
  type VacationCampingStay,
} from '@/lib/db'
import { getFaelligkeitenForHub } from '@/lib/db-wartung'
import { getAttentionSnoozes } from '@/lib/db-attention'
import { findCurrentOrNextVacation, type AttentionFeedInput } from '@/lib/attention-feed'
import {
  listSmartSuggestions,
  suggestionAdminOnly,
  suggestionHref,
  type SmartSuggestion,
} from '@/lib/smart-suggestions'
import { findRelevantVacation } from '@/lib/trip-readiness'
import { parseGeoPoint, type GeoPoint } from '@/lib/sonnen-hub-arrival'
import { todayInAppTimezone } from '@/lib/app-timezone'
import {
  findHubTravelNav,
  loadTravelNavRouteMatch,
  type HubTravelNavRouteMatch,
} from '@/lib/hub-travel-nav'

function vacationTitelForSuggestion(s: SmartSuggestion, vacations: Vacation[]): string | null {
  if (s.kind !== 'packing_add') return null
  const fromPayload = String(s.payload.vacation_titel ?? '').trim()
  if (fromPayload) return fromPayload
  const id = String(s.payload.vacation_id ?? s.kontext_id ?? '')
  if (!id) return null
  return vacations.find((v) => v.id === id)?.titel ?? null
}

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
  const countMode = opts.mode === 'count'
  const full = !countMode
  const vacations = await getVacations(db, opts.mitreisenderFilter)
  const relevant = findRelevantVacation(vacations)
  const hubVacation = findCurrentOrNextVacation(vacations)
  const sameHub = !!relevant && !!hubVacation && relevant.id === hubVacation.id
  const needsSonnenContext = countMode && !!hubVacation && !!opts.userPosition

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
    restzahlungStays,
    suggestionRows,
  ] = await Promise.all([
    relevant ? getPackingItemsForHub(db, relevant.id) : Promise.resolve<PackingItem[]>([]),
    relevant ? getPackStatus(db, relevant.id) : Promise.resolve<PackStatusData | null>(null),
    full && hubVacation && !sameHub
      ? getPackingItemsForHub(db, hubVacation.id)
      : Promise.resolve<PackingItem[] | null>(null),
    full && hubVacation && !sameHub
      ? getPackStatus(db, hubVacation.id)
      : Promise.resolve<PackStatusData | null>(null),
    (full || needsSonnenContext) && hubVacation
      ? getCampingStaysForVacation(db, hubVacation.id)
      : Promise.resolve<VacationCampingStay[]>([]),
    opts.includeWartungItems ? getFaelligkeitenForHub(db) : Promise.resolve([]),
    getChecklistenHubSummaries(db),
    opts.snoozes ? Promise.resolve(opts.snoozes) : getAttentionSnoozes(db),
    (full || needsSonnenContext) && opts.userId
      ? getUserById(db, opts.userId)
      : Promise.resolve(null),
    opts.includeOptimierungItems
      ? getOptimierungen(db, undefined, { relations: false })
      : Promise.resolve([]),
    getRestzahlungAttentionStays(db),
    listSmartSuggestions(db, { status: 'open', limit: 8 }),
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
    restzahlungStays,
    checklisten,
    snoozes,
    includeAdminItems: opts.includeAdminItems,
    includeWartungItems: opts.includeWartungItems,
    includeOptimierungItems: opts.includeOptimierungItems,
    includeTravelNav: full,
    smartSuggestions: suggestionRows.map((s) => ({
      id: s.id,
      kind: s.kind,
      titel: s.titel,
      begruendung: s.begruendung,
      href: suggestionHref(s),
      adminOnly: suggestionAdminOnly(s.kind),
      vacationTitel: vacationTitelForSuggestion(s, vacations),
    })),
  }
}
