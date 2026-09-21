import {
  getCampingStaysForVacation,
  getCampingStaysForVacations,
  getChecklistenHubSummaries,
  getOptimierungen,
  getPackingItemsForHub,
  getPackStatus,
  getRastplaetzeForHub,
  getRestzahlungAttentionStays,
  getUserById,
  getVacations,
  getVerbrauchMedien,
  getVerbrauchMedienAusruestungLinks,
  getVerbrauchMessungen,
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
import { normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import {
  findHubTravelNav,
  loadTravelNavRouteMatch,
  type HubTravelNavRouteMatch,
} from '@/lib/hub-travel-nav'
import { climateProxyTempForYmd, latFromCampingStays, midYmdBetween } from '@/lib/verbrauch-klima'
import {
  computeVerbrauchRateStats,
  evaluateReichweite,
  isVerbrauchMediumRelevant,
  reichweiteReiseTage,
  resolveVerfuegbareMenge,
} from '@/lib/verbrauch-reichweite'

function vacationTitelForSuggestion(s: SmartSuggestion, vacations: Vacation[]): string | null {
  if (s.kind !== 'packing_add') return null
  const fromPayload = String(s.payload.vacation_titel ?? '').trim()
  if (fromPayload) return fromPayload
  const id = String(s.payload.vacation_id ?? s.kontext_id ?? '')
  if (!id) return null
  return vacations.find((v) => v.id === id)?.titel ?? null
}

async function buildVerbrauchReichweiteItems(
  db: D1Database,
  opts: {
    vacation: Vacation
    packingItems: PackingItem[]
    campingStays: VacationCampingStay[]
    homeLat: number | null
  }
): Promise<AttentionFeedInput['verbrauchReichweiteItems']> {
  const [medien, links, messungen] = await Promise.all([
    getVerbrauchMedien(db, { onlyActive: true }),
    getVerbrauchMedienAusruestungLinks(db),
    getVerbrauchMessungen(db),
  ])
  if (medien.length === 0 || links.length === 0) return []

  const packingIds = new Set(
    opts.packingItems
      .map((p) => p.gegenstand_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )

  const relevantMedien = medien.filter((m) =>
    isVerbrauchMediumRelevant(m.id, links, packingIds)
  )
  if (relevantMedien.length === 0) return []

  const needsSeasonal = relevantMedien.some((m) => m.schluessel === 'petroleum')
  const urlaubIds = new Set<string>()
  urlaubIds.add(opts.vacation.id)
  if (needsSeasonal) {
    for (const m of messungen) {
      if (m.typ === 'petroleum' && m.urlaub_id) urlaubIds.add(m.urlaub_id)
    }
  }

  const staysByVacation = needsSeasonal
    ? await getCampingStaysForVacations(db, [...urlaubIds])
    : new Map<string, VacationCampingStay[]>([[opts.vacation.id, opts.campingStays]])

  if (needsSeasonal && !staysByVacation.has(opts.vacation.id)) {
    staysByVacation.set(opts.vacation.id, opts.campingStays)
  }

  const urlaubTempById = new Map<string, number>()
  for (const [vid, stays] of staysByVacation) {
    const lat = latFromCampingStays(stays) ?? opts.homeLat
    if (vid === opts.vacation.id) {
      const mid = midYmdBetween(
        opts.vacation.startdatum,
        opts.vacation.enddatum || opts.vacation.startdatum
      )
      urlaubTempById.set(vid, climateProxyTempForYmd(mid, lat))
      continue
    }
    const dated = stays.filter((s) => s.start_datum && s.end_datum)
    if (dated.length > 0) {
      const starts = dated.map((s) => s.start_datum!).sort()
      const ends = dated.map((s) => s.end_datum!).sort()
      const startRaw = starts[0]
      const endRaw = ends[ends.length - 1]
      if (startRaw && endRaw) {
        const start = normalizeCalendarDate(startRaw)
        const end = normalizeCalendarDate(endRaw)
        urlaubTempById.set(vid, climateProxyTempForYmd(midYmdBetween(start, end), lat))
      }
    } else {
      const m = messungen.find((x) => x.urlaub_id === vid && x.messdatum_start)
      if (m?.messdatum_start) {
        const mid = m.messdatum_ende
          ? midYmdBetween(m.messdatum_start, m.messdatum_ende)
          : normalizeCalendarDate(m.messdatum_start)
        urlaubTempById.set(vid, climateProxyTempForYmd(mid, lat))
      }
    }
  }

  const plannedLat = latFromCampingStays(opts.campingStays) ?? opts.homeLat
  const plannedTempC = climateProxyTempForYmd(
    midYmdBetween(
      opts.vacation.startdatum,
      opts.vacation.enddatum || opts.vacation.startdatum
    ),
    plannedLat
  )
  urlaubTempById.set(opts.vacation.id, plannedTempC)

  const days = reichweiteReiseTage(opts.vacation)
  const items: NonNullable<AttentionFeedInput['verbrauchReichweiteItems']> = []

  for (const medium of relevantMedien) {
    const verfuegbar = resolveVerfuegbareMenge(
      medium.schluessel,
      messungen,
      opts.vacation.id
    )
    if (verfuegbar == null) continue

    const stats = computeVerbrauchRateStats(medium, messungen, {
      urlaubTempById,
      plannedTempC,
    })
    const bewertung = evaluateReichweite({ medium, verfuegbar, days, stats })
    if (!bewertung || bewertung.ampel === 'ok') continue

    items.push({
      key: `verbrauch-reichweite:${medium.schluessel}:${opts.vacation.id}`,
      title: bewertung.title,
      reason: bewertung.reason,
      risk: bewertung.risk,
      href: '/tools/verbrauch',
      score: bewertung.ampel === 'kritisch' ? 520 : 480,
      ampel: bewertung.ampel,
    })
  }

  return items
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

  const reichweiteVacation = hubVacation ?? relevant
  let reichweitePacking: PackingItem[] =
    reichweiteVacation && hubVacation && relevant && hubVacation.id === relevant.id
      ? packingItems
      : reichweiteVacation && hubVacation && !sameHub
        ? (hubPackingExtra ?? [])
        : reichweiteVacation && relevant && reichweiteVacation.id === relevant.id
          ? packingItems
          : []

  if (
    reichweiteVacation &&
    reichweitePacking.length === 0 &&
    !(hubVacation && relevant && hubVacation.id === relevant.id)
  ) {
    // countMode lädt Hub-Packliste sonst nicht – für Relevanz nachladen
    reichweitePacking = await getPackingItemsForHub(db, reichweiteVacation.id)
  }

  let reichweiteStays = campingStays
  if (reichweiteVacation && hubVacation && reichweiteVacation.id !== hubVacation.id) {
    reichweiteStays = await getCampingStaysForVacation(db, reichweiteVacation.id)
  } else if (countMode && reichweiteVacation && campingStays.length === 0) {
    reichweiteStays = await getCampingStaysForVacation(db, reichweiteVacation.id)
  }

  const verbrauchReichweiteItems = reichweiteVacation
    ? await buildVerbrauchReichweiteItems(db, {
        vacation: reichweiteVacation,
        packingItems: reichweitePacking,
        campingStays: reichweiteStays,
        homeLat: homeCoords?.lat ?? null,
      })
    : []

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
    verbrauchReichweiteItems,
  }
}
