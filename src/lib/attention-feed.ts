import {
  differenceCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'
import type { ChecklisteHubAnlass } from '@/lib/checkliste-hub-anlass'
import type {
  Optimierung,
  PackingItem,
  PackStatusData,
  Rastplatz,
  Vacation,
  VacationCampingStay,
} from '@/lib/db'
import type { Faelligkeit } from '@/lib/db-wartung'
import { isSafetySnoozeBlocked } from '@/lib/attention-snooze'
import {
  computePackingProgress,
  findRelevantVacation,
  getDepartureDate,
  getTripPhase,
  type TripPhase,
} from '@/lib/trip-readiness'
import { isWinterpause } from '@/lib/winterpause'
import {
  attachTravelNavWaypoints,
  findHubTravelNav,
  type HubTravelNav,
  type HubTravelNavRouteMatch,
} from '@/lib/hub-travel-nav'
import {
  campingStayCoords,
  hasArrivedAtCampingForSunCard,
  previousStayBefore,
  type GeoPoint,
} from '@/lib/sonnen-hub-arrival'
import { formatBookingMoney } from '@/lib/booking-format'
import type { RestzahlungAttentionStay } from '@/lib/db'

export const MAX_ATTENTION_ITEMS = 7
/** Optimierungen in der Todo-Liste: fällig innerhalb dieser Tage (oder überfällig). */
export const OPTIMIERUNG_TODO_HORIZON_DAYS = 90
/** Restzahlungen in der Todo-Liste: fällig innerhalb dieser Tage (oder überfällig). */
export const RESTZAHLUNG_TODO_HORIZON_DAYS = 30

export type HubFrame =
  | 'winterpause'
  | 'planning_gap'
  | 'planning'
  | 'departure_approaching'
  | 'departure_day'
  | 'on_trip'
  | 'returned'

export type AttentionKind =
  | 'wartung_sicherheit'
  | 'wartung'
  | 'packing_incomplete'
  | 'packing_weight'
  | 'packing_vorgemerkt'
  | 'optimierung'
  | 'restzahlung'
  | 'checkliste'
  | 'vacation_next'
  | 'sonnen_ausrichtung'
  | 'vorschlag'

export type AttentionItem = {
  key: string
  kind: AttentionKind
  title: string
  reason: string
  risk: string | null
  href: string
  score: number
  dueYmd: string | null
  sicherheitsrelevant: boolean
  snoozeAllowed: boolean
  adminOnly: boolean
  /** Nur bei `kind: 'vorschlag'` – für direkte Aktionen im Hub. */
  suggestionId?: string
  suggestionKind?: string
  vacationTitel?: string | null
}

export type PackingWeightTone = 'low' | 'over'

export type AttentionPackingCard = {
  vacationId: string
  href: string
  percent: number
  packed: number
  total: number
  openCount: number
  complete: boolean
  weightTone: PackingWeightTone | null
  weightReserveKg: number | null
}

export type VacationTileCountdownKind = 'until_start' | 'remaining' | 'today' | 'last_day'

export type AttentionVacationTile = {
  id: string
  titel: string
  startdatum: string
  enddatum: string
  href: string
  campingplatzName: string | null
  extraCampingCount: number
  countdownDays: number | null
  countdownKind: VacationTileCountdownKind | null
}

export type AttentionVacationRef = {
  id: string
  titel: string
  startdatum: string
  enddatum: string
  reiseziel_name: string
}

export type AttentionFeed = {
  generatedAt: string
  frame: HubFrame
  headline: string
  subline: string | null
  vacation: AttentionVacationRef | null
  nextVacation: { id: string; titel: string; startdatum: string } | null
  vacationTile: AttentionVacationTile | null
  packing: AttentionPackingCard | null
  travelNav: HubTravelNav | null
  primaryAction: { label: string; href: string; reason: string }
  items: AttentionItem[]
  badgeCount: number
  snoozedCount: number
  quickLinks: { label: string; href: string }[]
}

/** Nur Fortschritt + Anlass – ohne volle Eintragstexte (spart Worker-CPU). */
export type AttentionCheckliste = {
  id: string
  titel: string
  hub_anlass: ChecklisteHubAnlass
  done: number
  total: number
}

export type AttentionFeedInput = {
  now?: Date
  vacations: Vacation[]
  packingItems: PackingItem[]
  packStatus: PackStatusData | null
  hubPackingItems?: PackingItem[]
  hubPackStatus?: PackStatusData | null
  campingStays?: VacationCampingStay[]
  userPosition?: GeoPoint | null
  homeCoords?: GeoPoint | null
  travelNavRastplaetze?: Rastplatz[]
  travelNavRouteMatch?: HubTravelNavRouteMatch | null
  faelligkeiten: Faelligkeit[]
  optimierungen: Optimierung[]
  restzahlungStays?: RestzahlungAttentionStay[]
  checklisten: AttentionCheckliste[]
  snoozes: Map<string, string>
  includeAdminItems: boolean
  includeWartungItems: boolean
  includeOptimierungItems: boolean
  /** false = Badge-Count ohne Fahrt-Leiste (Rasterplätze/Polyline). */
  includeTravelNav?: boolean
  smartSuggestions?: Array<{
    id: string
    kind: string
    titel: string
    begruendung: string | null
    href: string
    adminOnly: boolean
    vacationTitel?: string | null
  }>
}

function vacationRef(v: Vacation): AttentionVacationRef {
  return {
    id: v.id,
    titel: v.titel,
    startdatum: v.startdatum,
    enddatum: v.enddatum,
    reiseziel_name: v.reiseziel_name,
  }
}

function packingHref(vacationId: string, opts?: { profil?: 'uebersicht' }): string {
  const params = new URLSearchParams()
  params.set('vacation', vacationId)
  if (opts?.profil) params.set('profil', opts.profil)
  return `/packliste?${params.toString()}`
}

function formatCalendarDateDe(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function restzahlungOpenAmount(stay: RestzahlungAttentionStay): number | null {
  if (stay.preis_gesamt == null || !Number.isFinite(stay.preis_gesamt)) return null
  const paid = stay.anzahlung_betrag ?? 0
  const rest = stay.preis_gesamt - paid
  return rest > 0 ? rest : stay.preis_gesamt
}

function formatDaysUntil(dueYmd: string, todayYmd: string): string {
  const days = differenceCalendarDays(dueYmd, todayYmd)
  if (days < 0) {
    const n = Math.abs(days)
    return n === 1 ? 'seit 1 Tag überfällig' : `seit ${n} Tagen überfällig`
  }
  if (days === 0) return 'heute fällig'
  if (days === 1) return 'morgen fällig'
  return `in ${days} Tagen fällig`
}

function checklistProgress(list: AttentionCheckliste): { done: number; total: number } {
  return { done: list.done, total: list.total }
}

function isSnoozed(key: string, snoozes: Map<string, string>, todayYmd: string): boolean {
  const until = snoozes.get(key)
  if (!until) return false
  return normalizeCalendarDate(until) > todayYmd
}

function resolveFrame(
  vacations: Vacation[],
  relevant: Vacation | null,
  now: Date
): HubFrame {
  if (relevant) {
    const phase: TripPhase = getTripPhase(relevant, 3, now)
    if (phase === 'on_trip') return 'on_trip'
    if (phase === 'departure_day') return 'departure_day'
    if (phase === 'departure_approaching') return 'departure_approaching'
    if (phase === 'returned') return 'returned'
    if (phase === 'planning') {
      return isWinterpause(vacations, now) ? 'winterpause' : 'planning'
    }
  }
  return isWinterpause(vacations, now) ? 'winterpause' : 'planning_gap'
}

/** Laufender Urlaub, sonst der nächste geplante — ohne 7-Tage-Nachlauf. */
export function findCurrentOrNextVacation(vacations: Vacation[], now = new Date()): Vacation | null {
  if (vacations.length === 0) return null
  const today = todayInAppTimezone(now)
  const ongoing = vacations
    .filter((v) => {
      const start = normalizeCalendarDate(v.startdatum)
      const end = normalizeCalendarDate(v.enddatum)
      return start <= today && end >= today
    })
    .sort((a, b) =>
      normalizeCalendarDate(a.startdatum).localeCompare(normalizeCalendarDate(b.startdatum))
    )
  if (ongoing[0]) return ongoing[0]

  const upcoming = vacations
    .filter((v) => normalizeCalendarDate(v.startdatum) >= today)
    .sort((a, b) =>
      normalizeCalendarDate(a.startdatum).localeCompare(normalizeCalendarDate(b.startdatum))
    )
  return upcoming[0] ?? null
}

export function packingWeightTone(status: PackStatusData | null | undefined): PackingWeightTone | null {
  return packingWeightHighlight(status)?.tone ?? null
}

/** Kritischste Reserve (niedrigster Wert) – für Hub-Karte und Ton. */
export function packingWeightHighlight(
  status: PackStatusData | null | undefined
): { tone: PackingWeightTone; reserveKg: number } | null {
  if (!status) return null
  let worst: PackStatusData['transportOverview'][number] | null = null
  let over = false
  let low = false
  for (const t of status.transportOverview) {
    if (!worst || t.reserve < worst.reserve) worst = t
    const reservePct = t.zuladung > 0 ? (t.reserve / t.zuladung) * 100 : 0
    if (t.reserve < 0) over = true
    else if (reservePct < 10 && reservePct >= 0) low = true
  }
  if (!worst) return null
  if (over) return { tone: 'over', reserveKg: worst.reserve }
  if (low) return { tone: 'low', reserveKg: worst.reserve }
  return null
}

function stayNights(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  const days = differenceCalendarDays(normalizeCalendarDate(end), normalizeCalendarDate(start))
  return days > 0 ? days : 0
}

function vacationTileCountdown(
  vacation: Vacation,
  todayYmd: string
): Pick<AttentionVacationTile, 'countdownDays' | 'countdownKind'> {
  const start = normalizeCalendarDate(vacation.startdatum)
  const end = normalizeCalendarDate(vacation.enddatum)
  const untilStart = differenceCalendarDays(start, todayYmd)
  const untilEnd = differenceCalendarDays(end, todayYmd)

  if (untilStart > 0) {
    return { countdownDays: untilStart, countdownKind: 'until_start' }
  }
  if (untilEnd < 0) {
    return { countdownDays: null, countdownKind: null }
  }
  if (untilEnd === 0) {
    return { countdownDays: 1, countdownKind: 'last_day' }
  }
  if (untilStart === 0) {
    return { countdownDays: untilEnd + 1, countdownKind: 'today' }
  }
  return { countdownDays: untilEnd + 1, countdownKind: 'remaining' }
}

export function buildVacationTile(
  vacation: Vacation,
  stays: VacationCampingStay[],
  todayYmd: string
): AttentionVacationTile {
  const ranked = [...stays].sort((a, b) => {
    const nightDiff = stayNights(b.start_datum, b.end_datum) - stayNights(a.start_datum, a.end_datum)
    if (nightDiff !== 0) return nightDiff
    const aStart = a.start_datum ? normalizeCalendarDate(a.start_datum) : '9999-12-31'
    const bStart = b.start_datum ? normalizeCalendarDate(b.start_datum) : '9999-12-31'
    if (aStart !== bStart) return aStart.localeCompare(bStart)
    return (a.sort_index ?? 999999) - (b.sort_index ?? 999999)
  })
  const main = ranked[0] ?? null
  const uniqueIds = new Set(stays.map((s) => s.campingplatz_id))
  const campingplatzName =
    main?.campingplatz.name?.trim() || vacation.reiseziel_name?.trim() || null
  const extraCampingCount = main ? Math.max(0, uniqueIds.size - 1) : 0
  return {
    id: vacation.id,
    titel: vacation.titel,
    startdatum: vacation.startdatum,
    enddatum: vacation.enddatum,
    href: `/urlaube/${encodeURIComponent(vacation.id)}`,
    campingplatzName,
    extraCampingCount,
    ...vacationTileCountdown(vacation, todayYmd),
  }
}

function findFollowingVacation(
  vacations: Vacation[],
  relevant: Vacation | null,
  todayYmd: string
): Vacation | null {
  const upcoming = vacations
    .filter((v) => {
      const start = normalizeCalendarDate(v.startdatum)
      return start >= todayYmd && (!relevant || v.id !== relevant.id)
    })
    .sort((a, b) =>
      normalizeCalendarDate(a.startdatum).localeCompare(normalizeCalendarDate(b.startdatum))
    )
  return upcoming[0] ?? null
}

function contextCopy(
  frame: HubFrame,
  relevant: Vacation | null,
  following: Vacation | null,
  todayYmd: string
): { headline: string; subline: string | null } {
  if (relevant) {
    const name = relevant.titel
    if (frame === 'departure_day') {
      return { headline: `Heute geht’s los · ${name}`, subline: 'Packliste und Abfahrt zuerst.' }
    }
    if (frame === 'departure_approaching') {
      const dep = normalizeCalendarDate(getDepartureDate(relevant))
      const days = differenceCalendarDays(dep, todayYmd)
      return {
        headline: days === 1 ? `Abreise morgen · ${name}` : `Abreise in ${days} Tagen · ${name}`,
        subline: 'Offenes Packen und kritische Wartung haben Vorrang.',
      }
    }
    if (frame === 'on_trip') {
      const end = normalizeCalendarDate(relevant.enddatum)
      const left = differenceCalendarDays(end, todayYmd)
      return {
        headline: `Reise läuft · ${name}`,
        subline: left <= 0 ? 'Letzter Tag' : left === 1 ? 'noch 1 Tag' : `noch ${left + 1} Tage`,
      }
    }
    if (frame === 'returned') {
      return { headline: `Zurück von ${name}`, subline: 'Nachbereitung und offene Wartung.' }
    }
    if (frame === 'planning') {
      const dep = normalizeCalendarDate(getDepartureDate(relevant))
      const days = differenceCalendarDays(dep, todayYmd)
      return {
        headline: relevant.titel,
        subline: days > 0 ? `Abreise in ${days} Tagen` : null,
      }
    }
  }

  if (frame === 'winterpause') {
    const next = following ?? relevant
    if (next) {
      const start = normalizeCalendarDate(next.startdatum)
      return {
        headline: 'Winterpause',
        subline: `Nächster Urlaub: ${next.titel} (${start})`,
      }
    }
    return { headline: 'Winterpause', subline: 'Kein Urlaub in den nächsten Wochen.' }
  }

  return {
    headline: 'Kein Urlaub in Sicht',
    subline: 'Als Nächstes einen Urlaub anlegen oder offene Wartung erledigen.',
  }
}

function buildQuickLinks(
  frame: HubFrame,
  opts: { includeWartung: boolean; includeOptimierung: boolean }
): {
  label: string
  href: string
}[] {
  const links: { label: string; href: string }[] = []
  if (opts.includeWartung) {
    links.push({ label: 'Wartung', href: '/tools/wartung' })
  }
  links.push({ label: 'Checklisten', href: '/tools/checklisten' })
  if (frame === 'on_trip') {
    links.unshift({ label: 'Rastplätze', href: '/rastplaetze' })
  }
  if ((frame === 'winterpause' || frame === 'planning_gap') && opts.includeOptimierung) {
    links.push({ label: 'Optimierungen', href: '/tools/optimierungen' })
  }
  const seen = new Set<string>()
  return links.filter((l) => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  }).slice(0, 6)
}

function pickPrimaryAction(
  frame: HubFrame,
  items: AttentionItem[],
  packing: AttentionPackingCard | null,
  relevant: Vacation | null
): { label: string; href: string; reason: string } {
  const safety = items.find((i) => i.kind === 'wartung_sicherheit')
  if (safety) {
    return { label: safety.title, href: safety.href, reason: safety.reason }
  }
  if (
    packing &&
    !packing.complete &&
    (frame === 'departure_day' || frame === 'departure_approaching')
  ) {
    return {
      label: 'Packliste öffnen',
      href: packing.href,
      reason: `${packing.openCount} Einträge noch offen`,
    }
  }
  const checklist = items.find((i) => i.kind === 'checkliste')
  if (checklist && (frame === 'departure_day' || frame === 'on_trip')) {
    return { label: checklist.title, href: checklist.href, reason: checklist.reason }
  }
  if (packing) {
    return {
      label: packing.complete ? 'Packliste ansehen' : 'Packliste öffnen',
      href: packing.href,
      reason: packing.complete
        ? 'Alles gepackt'
        : `${packing.percent} % gepackt`,
    }
  }
  const first = items[0]
  if (first) {
    return { label: first.title, href: first.href, reason: first.reason }
  }
  if (relevant) {
    return {
      label: 'Urlaub öffnen',
      href: `/urlaube/${encodeURIComponent(relevant.id)}`,
      reason: relevant.titel,
    }
  }
  return {
    label: 'Urlaub anlegen',
    href: '/urlaube',
    reason: 'Noch kein relevanter Urlaub',
  }
}

function formatOpenEntries(n: number): string {
  return n === 1 ? '1 Eintrag noch offen' : `${n} Einträge noch offen`
}

function packingIncompleteAttention(
  relevant: Vacation,
  packingItems: PackingItem[],
  now: Date
): AttentionItem | null {
  const phase = getTripPhase(relevant, 3, now)
  if (phase !== 'departure_day' && phase !== 'departure_approaching') return null

  const departure = getDepartureDate(relevant)
  const regularOpen = computePackingProgress(packingItems, departure, now, 'exclude').open_items_count
  const abreiseOpen = computePackingProgress(packingItems, departure, now, 'only').open_items_count

  const base = {
    key: `packing:${relevant.id}`,
    kind: 'packing_incomplete' as const,
    href: packingHref(relevant.id),
    dueYmd: normalizeCalendarDate(departure),
    sicherheitsrelevant: false,
    snoozeAllowed: true,
    adminOnly: false,
  }

  if (phase === 'departure_approaching') {
    if (regularOpen <= 0) return null
    return {
      ...base,
      title: 'Packliste unvollständig',
      reason: formatOpenEntries(regularOpen),
      risk: 'Ohne Restpacken wird die Abreise stressig.',
      score: 800,
    }
  }

  if (regularOpen <= 0 && abreiseOpen <= 0) return null

  if (regularOpen <= 0) {
    return {
      ...base,
      title: 'Noch am Abreisetag packen',
      reason:
        abreiseOpen === 1
          ? '1 Eintrag für den Abreisetag offen'
          : `${abreiseOpen} Einträge für den Abreisetag offen`,
      risk: 'Diese Einträge sind erst heute in der Packliste vorgesehen.',
      score: 850,
    }
  }

  if (abreiseOpen > 0) {
    return {
      ...base,
      title: 'Packliste unvollständig',
      reason: `${formatOpenEntries(regularOpen)} · ${
        abreiseOpen === 1 ? '1 erst am Abreisetag' : `${abreiseOpen} erst am Abreisetag`
      }`,
      risk: 'Ohne Restpacken wird die Abreise stressig.',
      score: 850,
    }
  }

  return {
    ...base,
    title: 'Packliste unvollständig',
    reason: formatOpenEntries(regularOpen),
    risk: 'Ohne Restpacken wird die Abreise stressig.',
    score: 850,
  }
}

export function buildAttentionFeed(input: AttentionFeedInput): AttentionFeed {
  const now = input.now ?? new Date()
  const todayYmd = todayInAppTimezone(now)
  const relevant = findRelevantVacation(input.vacations, now)
  const tileVacation = findCurrentOrNextVacation(input.vacations, now)
  const following = findFollowingVacation(input.vacations, relevant, todayYmd)
  const frame = resolveFrame(input.vacations, relevant, now)
  const { headline, subline } = contextCopy(frame, relevant, following, todayYmd)

  const tilePackingItems =
    input.hubPackingItems ??
    (tileVacation && relevant && tileVacation.id === relevant.id ? input.packingItems : [])
  const tilePackStatus =
    input.hubPackStatus ??
    (tileVacation && relevant && tileVacation.id === relevant.id ? input.packStatus : null)

  let relevantPacking: AttentionPackingCard | null = null
  if (relevant) {
    const progress = computePackingProgress(input.packingItems, getDepartureDate(relevant), now)
    const weight = packingWeightHighlight(input.packStatus)
    relevantPacking = {
      vacationId: relevant.id,
      href: packingHref(relevant.id),
      percent: progress.percent,
      packed: progress.packed,
      total: progress.total,
      openCount: progress.open_items_count,
      complete: progress.complete,
      weightTone: weight?.tone ?? null,
      weightReserveKg: weight?.reserveKg ?? null,
    }
  }

  let packing: AttentionPackingCard | null = null
  if (tileVacation && relevant && tileVacation.id === relevant.id) {
    packing = relevantPacking
  } else if (tileVacation) {
    const progress = computePackingProgress(tilePackingItems, getDepartureDate(tileVacation), now)
    const weight = packingWeightHighlight(tilePackStatus)
    packing = {
      vacationId: tileVacation.id,
      href: packingHref(tileVacation.id),
      percent: progress.percent,
      packed: progress.packed,
      total: progress.total,
      openCount: progress.open_items_count,
      complete: progress.complete,
      weightTone: weight?.tone ?? null,
      weightReserveKg: weight?.reserveKg ?? null,
    }
  }

  const vacationTile = tileVacation
    ? buildVacationTile(tileVacation, input.campingStays ?? [], todayYmd)
    : null
  const travelNavBase =
    input.includeTravelNav === false
      ? null
      : tileVacation
        ? findHubTravelNav({
            vacation: tileVacation,
            stays: input.campingStays ?? [],
            homeCoords: input.homeCoords ?? null,
            userPosition: input.userPosition ?? null,
            todayYmd,
          })
        : null
  const travelNav = travelNavBase
    ? attachTravelNavWaypoints(
        travelNavBase,
        input.travelNavRastplaetze ?? [],
        input.travelNavRouteMatch
      )
    : null

  const raw: AttentionItem[] = []

  if (relevant) {
    const packingTodo = packingIncompleteAttention(relevant, input.packingItems, now)
    if (packingTodo) raw.push(packingTodo)
  }

  if (relevant && input.packStatus) {
    const overloaded = input.packStatus.transportOverview.filter((t) => t.reserve < 0)
    if (overloaded.length > 0) {
      const names = overloaded.map((t) => t.transportName).join(', ')
      raw.push({
        key: `packing-weight:${relevant.id}`,
        kind: 'packing_weight',
        title: 'Zuladung überschritten',
        reason: names,
        risk: 'Überladung ist unsicher und kann teuer werden.',
        href: `/pack-status?vacation=${encodeURIComponent(relevant.id)}`,
        score: 840,
        dueYmd: normalizeCalendarDate(getDepartureDate(relevant)),
        sicherheitsrelevant: false,
        snoozeAllowed: true,
        adminOnly: false,
      })
    }
  }

  if (relevant && input.includeAdminItems) {
    const progress = computePackingProgress(input.packingItems, getDepartureDate(relevant), now)
    const vorgemerkt = progress.openItems.filter((i) => i.vorgemerkt).length
    if (vorgemerkt > 0) {
      raw.push({
        key: `packing-vorgemerkt:${relevant.id}`,
        kind: 'packing_vorgemerkt',
        title: 'Packen bestätigen',
        reason:
          vorgemerkt === 1
            ? '1 vorgemerkter Eintrag wartet'
            : `${vorgemerkt} vorgemerkte Einträge warten`,
        risk: null,
        href: packingHref(relevant.id, { profil: 'uebersicht' }),
        score: 450,
        dueYmd: null,
        sicherheitsrelevant: false,
        snoozeAllowed: true,
        adminOnly: true,
      })
    }
  }

  if (input.includeWartungItems) {
    for (const f of input.faelligkeiten) {
      if (f.is_archived) continue
      const status = f.ampel_status
      if (status !== 'ueberfaellig' && status !== 'bald_faellig') continue
      const due = f.naechste_faelligkeit || f.gueltig_bis || null
      const dueYmd = due ? normalizeCalendarDate(due) : null
      const safety = !!f.sicherheitsrelevant
      const overdue = status === 'ueberfaellig'
      const kind: AttentionKind = safety ? 'wartung_sicherheit' : 'wartung'
      let score = 600
      if (safety && overdue) score = 1000
      else if (safety) score = 900
      else if (overdue) score = 700
      raw.push({
        key: `wartung:${f.id}`,
        kind,
        title: f.name,
        reason: dueYmd ? formatDaysUntil(dueYmd, todayYmd) : 'Bald fällig',
        risk: safety
          ? 'Sicherheitsrelevante Wartung sollte nicht liegen bleiben.'
          : overdue
            ? 'Überfällige Wartung kann teurer oder unsicherer werden.'
            : null,
        href: `/tools/wartung?bearbeiten=${encodeURIComponent(f.id)}`,
        score,
        dueYmd,
        sicherheitsrelevant: safety,
        snoozeAllowed: !(safety && isSafetySnoozeBlocked(dueYmd, todayYmd)),
        adminOnly: false,
      })
    }
  }

  if (input.includeOptimierungItems) {
    for (const o of input.optimierungen) {
      if (o.status !== 'geplant' && o.status !== 'in_arbeit') continue
      const dueYmd = o.faellig_am ? normalizeCalendarDate(o.faellig_am) : null
      const winterBoost =
        frame === 'winterpause' &&
        (o.zeitfenster === 'winter' || o.zeitfenster === 'vor_saison' || o.zeitfenster === 'nach_saison')
      const forNextVacation = o.faelligkeit_modus === 'naechster_urlaub'
      if (!dueYmd && !winterBoost) continue
      const daysUntilDue = dueYmd ? differenceCalendarDays(dueYmd, todayYmd) : null
      if (
        daysUntilDue != null &&
        daysUntilDue > OPTIMIERUNG_TODO_HORIZON_DAYS &&
        !winterBoost &&
        !forNextVacation
      ) {
        continue
      }
      const overdue = daysUntilDue != null && daysUntilDue < 0
      const beyondHorizon =
        daysUntilDue != null && daysUntilDue > OPTIMIERUNG_TODO_HORIZON_DAYS
      raw.push({
        key: `optimierung:${o.id}`,
        kind: 'optimierung',
        title: o.titel,
        reason: dueYmd
          ? forNextVacation
            ? `${formatDaysUntil(dueYmd, todayYmd)} · nächster Urlaub`
            : formatDaysUntil(dueYmd, todayYmd)
          : 'Passt in die Winterpause',
        risk: null,
        href: `/tools/optimierungen/${encodeURIComponent(o.id)}`,
        score: overdue ? 550 : winterBoost || beyondHorizon ? 300 : 500,
        dueYmd,
        sicherheitsrelevant: false,
        snoozeAllowed: true,
        adminOnly: false,
      })
    }
  }

  for (const stay of input.restzahlungStays ?? []) {
    const dueYmd = normalizeCalendarDate(stay.restzahlung_faellig_am)
    const daysUntil = differenceCalendarDays(dueYmd, todayYmd)
    if (daysUntil > RESTZAHLUNG_TODO_HORIZON_DAYS) continue
    const name = stay.campingplatz_name?.trim() || 'Campingplatz'
    const openAmount = restzahlungOpenAmount(stay)
    const amountLabel =
      openAmount != null ? formatBookingMoney(openAmount, stay.waehrung) : null
    const overdue = daysUntil < 0
    raw.push({
      key: `restzahlung:${stay.id}`,
      kind: 'restzahlung',
      title: `Restzahlung · ${name}`,
      reason: amountLabel
        ? `${formatCalendarDateDe(dueYmd)} · ${amountLabel} · ${formatDaysUntil(dueYmd, todayYmd)}`
        : `${formatCalendarDateDe(dueYmd)} · ${formatDaysUntil(dueYmd, todayYmd)}`,
      risk: overdue
        ? 'Restzahlung überfällig – bitte zeitnah überweisen.'
        : daysUntil <= 7
          ? 'Bald fällig – rechtzeitig überweisen.'
          : null,
      href: `/urlaube/${encodeURIComponent(stay.urlaub_id)}`,
      score: overdue ? 640 : daysUntil <= 7 ? 600 : 560,
      dueYmd,
      sicherheitsrelevant: false,
      snoozeAllowed: true,
      adminOnly: false,
    })
  }

  const departureYmd = relevant
    ? normalizeCalendarDate(getDepartureDate(relevant))
    : null
  const startYmd = relevant ? normalizeCalendarDate(relevant.startdatum) : null

  for (const list of input.checklisten) {
    const anlass = (list.hub_anlass ?? 'keine') as ChecklisteHubAnlass
    if (anlass === 'keine') continue
    const { done, total } = checklistProgress(list)
    if (total > 0 && done >= total) continue

    let show = false
    let score = 400
    if (anlass === 'abfahrt' && departureYmd && todayYmd === departureYmd) show = true
    if (anlass === 'ankunft' && startYmd && todayYmd === startYmd) show = true
    if (anlass === 'einwintern' && frame === 'winterpause') {
      show = true
      score = 350
    }
    if (anlass === 'auswintern' && (frame === 'planning' || frame === 'departure_approaching')) {
      show = true
      score = 360
    }
    if (!show) continue

    const rest = Math.max(total - done, 0)
    raw.push({
      key: `checkliste:${list.id}`,
      kind: 'checkliste',
      title: list.titel,
      reason:
        total === 0
          ? 'Noch keine Einträge'
          : rest === 1
            ? '1 Punkt offen'
            : `${rest} Punkte offen`,
      risk: null,
      href: `/tools/checklisten?id=${encodeURIComponent(list.id)}`,
      score,
      dueYmd: anlass === 'abfahrt' ? departureYmd : anlass === 'ankunft' ? startYmd : null,
      sicherheitsrelevant: false,
      snoozeAllowed: true,
      adminOnly: false,
    })
  }

  for (const stay of input.campingStays ?? []) {
    if (!stay.start_datum) continue
    if (normalizeCalendarDate(stay.start_datum) !== todayYmd) continue
    const dest = campingStayCoords(stay)
    const prev = previousStayBefore(input.campingStays ?? [], stay)
    const originFromPrev = prev ? campingStayCoords(prev) : null
    const origin = originFromPrev ?? input.homeCoords ?? null
    const originIsDest =
      dest && origin && dest.lat === origin.lat && dest.lng === origin.lng
    if (
      !hasArrivedAtCampingForSunCard({
        destination: dest,
        origin: originIsDest ? null : origin,
        user: input.userPosition ?? null,
      })
    ) {
      continue
    }
    const name = stay.campingplatz.name?.trim() || 'Campingplatz'
    raw.push({
      key: `sonne:${stay.id}`,
      kind: 'sonnen_ausrichtung',
      title: 'Sonnenausrichtung',
      reason: `Erster Tag · ${name}`,
      risk: 'Heute den Stellplatz nach Sonne und Schatten ausrichten.',
      href: '/tools/sonnen-ausrichtung',
      score: 470,
      dueYmd: todayYmd,
      sicherheitsrelevant: false,
      snoozeAllowed: true,
      adminOnly: false,
    })
  }

  for (const s of input.smartSuggestions ?? []) {
    if (s.adminOnly && !input.includeAdminItems) continue
    raw.push({
      key: `vorschlag:${s.id}`,
      kind: 'vorschlag',
      title: s.titel,
      reason: s.begruendung || 'Vorschlag aus euren Daten',
      risk: null,
      href: s.href,
      score: 40,
      dueYmd: null,
      sicherheitsrelevant: false,
      snoozeAllowed: true,
      adminOnly: s.adminOnly,
      suggestionId: s.id,
      suggestionKind: s.kind,
      vacationTitel: s.vacationTitel ?? null,
    })
  }

  const visible = raw.filter((item) => {
    if (item.sicherheitsrelevant && isSafetySnoozeBlocked(item.dueYmd, todayYmd)) {
      return true
    }
    return !isSnoozed(item.key, input.snoozes, todayYmd)
  })

  const snoozedCount = raw.length - visible.length
  visible.sort((a, b) => {
    const aHint = a.kind === 'vorschlag' ? 1 : 0
    const bHint = b.kind === 'vorschlag' ? 1 : 0
    if (aHint !== bHint) return aHint - bHint
    return b.score - a.score || a.title.localeCompare(b.title, 'de')
  })
  const primaryAction = pickPrimaryAction(
    frame,
    visible.slice(0, MAX_ATTENTION_ITEMS),
    relevantPacking,
    relevant
  )

  return {
    generatedAt: now.toISOString(),
    frame,
    headline,
    subline,
    vacation: relevant ? vacationRef(relevant) : null,
    vacationTile,
    nextVacation: following
      ? {
          id: following.id,
          titel: following.titel,
          startdatum: following.startdatum,
        }
      : relevant && frame === 'winterpause'
        ? {
            id: relevant.id,
            titel: relevant.titel,
            startdatum: relevant.startdatum,
          }
        : null,
    packing,
    travelNav,
    primaryAction,
    items: visible,
    badgeCount: visible.length,
    snoozedCount,
    quickLinks: buildQuickLinks(frame, {
      includeWartung: input.includeWartungItems,
      includeOptimierung: input.includeOptimierungItems,
    }),
  }
}
