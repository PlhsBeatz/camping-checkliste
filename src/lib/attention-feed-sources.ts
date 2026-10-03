import type { D1Database } from '@cloudflare/workers-types'
import {
  getCampingStaysForVacation,
  getChecklistenHubSummaries,
  getOptimierungen,
  getPackingGegenstandIdsForVacation,
  getPackingItemsForHub,
  getPackStatus,
  getRastplaetzeForHub,
  getRestzahlungAttentionStays,
  getUserById,
  getVacations,
  getVerbrauchClimateStayHints,
  getVerbrauchMedien,
  getVerbrauchMedienAusruestungLinks,
  getVerbrauchMessungenForReichweite,
  type PackingItem,
  type PackStatusData,
  type Rastplatz,
  type RestzahlungAttentionStay,
  type Vacation,
  type VacationCampingStay,
  type VerbrauchClimateStayHint,
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
import { verbrauchUebersichtCutoffYmd } from '@/lib/verbrauch-uebersicht'
import {
  computeVerbrauchRateStats,
  evaluateReichweite,
  evaluateReichweiteAmpel,
  isVerbrauchMediumRelevant,
  reichweiteReiseTage,
  resolveVerfuegbareMenge,
} from '@/lib/verbrauch-reichweite'

function packingGegenstandIds(items: PackingItem[]): Set<string> {
  return new Set(
    items
      .map((p) => p.gegenstand_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )
}

function vacationTitelForSuggestion(s: SmartSuggestion, vacations: Vacation[]): string | null {
  if (s.kind !== 'packing_add') return null
  const fromPayload = String(s.payload.vacation_titel ?? '').trim()
  if (fromPayload) return fromPayload
  const id = String(s.payload.vacation_id ?? s.kontext_id ?? '')
  if (!id) return null
  return vacations.find((v) => v.id === id)?.titel ?? null
}

function latFromClimateHints(
  hints: VerbrauchClimateStayHint[],
  fallbackStays?: VacationCampingStay[],
  homeLat?: number | null
): number | null {
  return (
    latFromCampingStays(hints) ??
    (fallbackStays ? latFromCampingStays(fallbackStays) : null) ??
    homeLat ??
    null
  )
}

async function buildVerbrauchReichweiteItems(
  db: D1Database,
  opts: {
    vacation: Vacation
    packingGegenstandIds: Set<string>
    campingStays: VacationCampingStay[]
    homeLat: number | null
    /** full = Kartentexte; light = nur Badge-Keys (weniger CPU, Lat aus Climate-Hints). */
    detail: 'full' | 'light'
  }
): Promise<AttentionFeedInput['verbrauchReichweiteItems']> {
  const [medien, links] = await Promise.all([
    getVerbrauchMedien(db, { onlyActive: true }),
    getVerbrauchMedienAusruestungLinks(db),
  ])
  if (medien.length === 0 || links.length === 0) return []

  const relevantMedien = medien.filter((m) =>
    isVerbrauchMediumRelevant(m.id, links, opts.packingGegenstandIds)
  )
  if (relevantMedien.length === 0) return []

  const sinceYmd = verbrauchUebersichtCutoffYmd()
  const messungen = await getVerbrauchMessungenForReichweite(db, {
    sinceYmd,
    includeUrlaubId: opts.vacation.id,
  })

  const needsSeasonal = relevantMedien.some((m) => m.schluessel === 'petroleum')
  const urlaubIds = new Set<string>()
  urlaubIds.add(opts.vacation.id)
  if (needsSeasonal) {
    for (const m of messungen) {
      if (m.typ === 'petroleum' && m.urlaub_id) urlaubIds.add(m.urlaub_id)
    }
  }

  const climateHints = needsSeasonal
    ? await getVerbrauchClimateStayHints(db, [...urlaubIds])
    : new Map<string, VerbrauchClimateStayHint[]>()

  const urlaubTempById = new Map<string, number>()
  for (const vid of urlaubIds) {
    const hints = climateHints.get(vid) ?? []
    const lat = latFromClimateHints(
      hints,
      vid === opts.vacation.id ? opts.campingStays : undefined,
      opts.homeLat
    )
    if (vid === opts.vacation.id) {
      const mid = midYmdBetween(
        opts.vacation.startdatum,
        opts.vacation.enddatum || opts.vacation.startdatum
      )
      urlaubTempById.set(vid, climateProxyTempForYmd(mid, lat))
      continue
    }
    const dated = hints.filter((s) => s.start_datum && s.end_datum)
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

  const currentHints = climateHints.get(opts.vacation.id) ?? []
  const plannedLat =
    latFromCampingStays(opts.campingStays) ??
    latFromClimateHints(currentHints, undefined, opts.homeLat) ??
    opts.homeLat
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
  const light = opts.detail === 'light'

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

    if (light) {
      const ampel = evaluateReichweiteAmpel({ verfuegbar, days, stats })
      if (!ampel || ampel === 'ok') continue
      items.push({
        key: `verbrauch-reichweite:${medium.schluessel}:${opts.vacation.id}`,
        title: medium.name,
        reason: '',
        risk: null,
        href: `/tools/verbrauch?medium=${encodeURIComponent(medium.schluessel)}`,
        score: ampel === 'kritisch' ? 520 : 480,
        ampel,
      })
      continue
    }

    const bewertung = evaluateReichweite({ medium, verfuegbar, days, stats })
    if (!bewertung || bewertung.ampel === 'ok') continue

    items.push({
      key: `verbrauch-reichweite:${medium.schluessel}:${opts.vacation.id}`,
      title: bewertung.title,
      reason: bewertung.reason,
      risk: bewertung.risk,
      href: `/tools/verbrauch?medium=${encodeURIComponent(medium.schluessel)}`,
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
    /**
     * count = Badge-Zahl ohne Travel-Nav/Tile-Extras.
     * Verbrauch-Reichweite zählt mit, aber über einen schlanken Pfad (IDs + Climate-Hints).
     */
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
  const needsReichweite = !!(hubVacation ?? relevant)

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
    // Extra-Hub-Packliste nur im Full-Feed (Tile/Travel)
    full && hubVacation && !sameHub
      ? getPackingItemsForHub(db, hubVacation.id)
      : Promise.resolve<PackingItem[] | null>(null),
    full && hubVacation && !sameHub
      ? getPackStatus(db, hubVacation.id)
      : Promise.resolve<PackStatusData | null>(null),
    // Stays: Full-Feed (Sonne/Travel/Klima) oder Count nur bei Live-GPS für Sonne
    hubVacation && (full || needsSonnenContext)
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

  let verbrauchReichweiteItems: AttentionFeedInput['verbrauchReichweiteItems'] = []
  if (needsReichweite) {
    const reichweiteVacation = hubVacation ?? relevant
    if (reichweiteVacation) {
      let packingIds: Set<string>
      if (hubVacation && relevant && hubVacation.id === relevant.id) {
        packingIds = packingGegenstandIds(packingItems)
      } else if (hubVacation && !sameHub) {
        packingIds = full
          ? packingGegenstandIds(hubPackingExtra ?? [])
          : new Set(await getPackingGegenstandIdsForVacation(db, reichweiteVacation.id))
      } else {
        packingIds = packingGegenstandIds(packingItems)
      }

      // Count: keine vollen Stays – Lat kommt aus Climate-Hints (Petroleum).
      const reichweiteStays = full
        ? hubVacation && reichweiteVacation.id === hubVacation.id
          ? campingStays
          : await getCampingStaysForVacation(db, reichweiteVacation.id)
        : []

      verbrauchReichweiteItems = await buildVerbrauchReichweiteItems(db, {
        vacation: reichweiteVacation,
        packingGegenstandIds: packingIds,
        campingStays: reichweiteStays,
        homeLat: homeCoords?.lat ?? null,
        detail: full ? 'full' : 'light',
      })
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
    verbrauchReichweiteItems,
  }
}
