/**
 * Packlisten-Vorschläge an Zielregion, ähnliche Kalenderlage und Reisedauer koppeln.
 * Saison-Tags allein reichen nicht: Groundcover lohnt sich nicht fürs Wochenende;
 * Schattennetz nach Italien, nicht nach Dänemark.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { differenceCalendarDays } from '@/lib/app-timezone'
import { countryIso2ForLandName } from '@/lib/country-flag-emoji'

export type TripPackProfile = {
  id: string
  start: string
  end: string
  days: number
  countries: string[]
}

export type ItemTripOccurrence = {
  gegenstand_id: string
  vacation_id: string
  start: string
  end: string
  days: number
  countries: string[]
}

export type ItemFitReason = 'ok' | 'duration' | 'region' | 'date'

export type ItemFitResult = {
  ok: boolean
  reason: ItemFitReason
}

const SOUTH = new Set([
  'IT',
  'ES',
  'PT',
  'GR',
  'HR',
  'ME',
  'AL',
  'CY',
  'TR',
  'MT',
  'SI',
  'BA',
  'MK',
])
const NORTH = new Set(['DK', 'SE', 'NO', 'FI', 'IS', 'EE', 'LV', 'LT'])

function climateBand(cc: string): 'south' | 'north' | 'other' {
  if (SOUTH.has(cc)) return 'south'
  if (NORTH.has(cc)) return 'north'
  return 'other'
}

export function tripDaysInclusive(start: string, end: string): number {
  const d = differenceCalendarDays(end, start)
  if (!Number.isFinite(d)) return 1
  return Math.max(1, d + 1)
}

function dayOfYear(ymd: string): number {
  const m = Number(ymd.slice(5, 7))
  const d = Number(ymd.slice(8, 10))
  const md = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) return 1
  return (md[m - 1] ?? 0) + d
}

function circularDayDist(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, 365 - d)
}

function durationCompatible(targetDays: number, packedDays: number): boolean {
  if (Math.abs(targetDays - packedDays) <= 3) return true
  const bucket = (n: number) => (n <= 3 ? 0 : n <= 7 ? 1 : n <= 13 ? 2 : 3)
  return Math.abs(bucket(targetDays) - bucket(packedDays)) <= 1 && targetDays >= packedDays * 0.45
}

function sharesCountry(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  return a.some((c) => b.includes(c))
}

function parseCountryTokens(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return []
  const parts = raw.split(/[,;/|]+/).map((p) => p.trim()).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    const cc = countryIso2ForLandName(p)
    if (cc && !out.includes(cc)) out.push(cc)
  }
  const whole = countryIso2ForLandName(raw)
  if (whole && !out.includes(whole)) out.push(whole)
  return out
}

function uniqueCountries(lists: string[][]): string[] {
  const out: string[] = []
  for (const list of lists) {
    for (const c of list) if (!out.includes(c)) out.push(c)
  }
  return out
}

export function itemFitsTargetTrip(
  target: TripPackProfile,
  packedOn: ItemTripOccurrence[],
  allTrips: TripPackProfile[]
): ItemFitResult {
  const packed = packedOn.filter((p) => p.vacation_id !== target.id)
  if (packed.length === 0) return { ok: true, reason: 'ok' }

  if (target.countries.length > 0) {
    const tripsInTarget = allTrips.filter(
      (t) => t.id !== target.id && sharesCountry(t.countries, target.countries)
    )
    const packedInTarget = packed.filter((p) => sharesCountry(p.countries, target.countries))
    if (tripsInTarget.length >= 1 && packedInTarget.length === 0) {
      return { ok: false, reason: 'region' }
    }
    if (tripsInTarget.length >= 2 && packedInTarget.length / tripsInTarget.length < 0.3) {
      return { ok: false, reason: 'region' }
    }
    if (tripsInTarget.length === 0 && packed.length >= 2) {
      const packedCc = uniqueCountries(packed.map((p) => p.countries))
      const packedBands = new Set(packedCc.map(climateBand).filter((b) => b !== 'other'))
      const targetBands = new Set(target.countries.map(climateBand).filter((b) => b !== 'other'))
      if (packedBands.size === 1 && targetBands.size === 1 && [...packedBands][0] !== [...targetBands][0]) {
        return { ok: false, reason: 'region' }
      }
    }
  }

  if (packed.length >= 2) {
    if (target.days <= 3 && packed.every((p) => p.days >= 8)) {
      return { ok: false, reason: 'duration' }
    }
    const similarDur = packed.filter((p) => durationCompatible(target.days, p.days))
    if (similarDur.length === 0) return { ok: false, reason: 'duration' }
    const sorted = [...packed.map((p) => p.days)].sort((a, b) => a - b)
    const mid = sorted[Math.floor(sorted.length / 2)] ?? target.days
    if (target.days <= 4 && mid >= 12) return { ok: false, reason: 'duration' }
  }

  if (packed.length >= 2) {
    const targetDoy = dayOfYear(target.start)
    const close = packed.some((p) => circularDayDist(dayOfYear(p.start), targetDoy) <= 40)
    if (!close) return { ok: false, reason: 'date' }
  }

  return { ok: true, reason: 'ok' }
}

export function fitReasonText(reason: ItemFitReason, days: number): string | null {
  if (reason === 'ok') {
    if (days <= 3) return 'Auf ähnlich kurzen Reisen oft dabei.'
    if (days >= 8) return 'Typisch für Reisen dieser Länge und Jahreszeit.'
    return 'In vergleichbaren Reisen oft dabei.'
  }
  return null
}

export async function loadTripPackProfiles(db: D1Database): Promise<Map<string, TripPackProfile>> {
  const [vacRes, landRes] = await Promise.all([
    db
      .prepare(`SELECT id, startdatum, enddatum, land_region FROM urlaube`)
      .all<{ id: string; startdatum: string; enddatum: string; land_region: string | null }>(),
    db
      .prepare(
        `SELECT uc.urlaub_id, c.land
         FROM urlaub_campingplaetze uc
         JOIN campingplaetze c ON c.id = uc.campingplatz_id`
      )
      .all<{ urlaub_id: string; land: string | null }>(),
  ])

  const byId = new Map<string, TripPackProfile>()
  for (const v of vacRes.results || []) {
    byId.set(v.id, {
      id: v.id,
      start: v.startdatum,
      end: v.enddatum,
      days: tripDaysInclusive(v.startdatum, v.enddatum),
      countries: parseCountryTokens(v.land_region),
    })
  }
  for (const row of landRes.results || []) {
    const trip = byId.get(row.urlaub_id)
    if (!trip) continue
    for (const cc of parseCountryTokens(row.land)) {
      if (!trip.countries.includes(cc)) trip.countries.push(cc)
    }
  }
  return byId
}

export async function loadItemTripOccurrences(
  db: D1Database,
  trips: Map<string, TripPackProfile>
): Promise<Map<string, ItemTripOccurrence[]>> {
  const res = await db
    .prepare(
      `SELECT DISTINCT pe.gegenstand_id, p.urlaub_id
       FROM packlisten_eintraege pe
       JOIN packlisten p ON pe.packliste_id = p.id
       JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
       WHERE ag.status != 'Ausgemustert' AND ag.is_standard = 0`
    )
    .all<{ gegenstand_id: string; urlaub_id: string }>()

  const out = new Map<string, ItemTripOccurrence[]>()
  for (const row of res.results || []) {
    const trip = trips.get(row.urlaub_id)
    if (!trip) continue
    const arr = out.get(row.gegenstand_id) ?? []
    if (arr.some((x) => x.vacation_id === trip.id)) continue
    arr.push({
      gegenstand_id: row.gegenstand_id,
      vacation_id: trip.id,
      start: trip.start,
      end: trip.end,
      days: trip.days,
      countries: trip.countries,
    })
    out.set(row.gegenstand_id, arr)
  }
  return out
}

export function profileFromVacation(
  vacation: { id: string; startdatum: string; enddatum: string; land_region?: string | null },
  campingLands: Array<string | null | undefined>
): TripPackProfile {
  const countries = parseCountryTokens(vacation.land_region)
  for (const land of campingLands) {
    for (const cc of parseCountryTokens(land)) {
      if (!countries.includes(cc)) countries.push(cc)
    }
  }
  return {
    id: vacation.id,
    start: vacation.startdatum,
    end: vacation.enddatum,
    days: tripDaysInclusive(vacation.startdatum, vacation.enddatum),
    countries,
  }
}
