import type { D1Database } from '@cloudflare/workers-types'
import type { ParsedBookingFields } from './booking-types'
import { getVacations, getCampingStaysForVacation, getCampingplaetze } from './db'

export type StayMatchSuggestion = {
  urlaub_id: string
  urlaub_titel: string
  stay_id: string | null
  campingplatz_id: string | null
  campingplatz_name: string | null
  confidence: 'high' | 'medium' | 'low'
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle || needle.length < 3) return false
  const h = normalize(haystack)
  const n = normalize(needle)
  return h.includes(n) || n.includes(h)
}

function datesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null,
  bEnd: string | null
): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false
  return aStart <= bEnd && bStart <= aEnd
}

function vacationContainsDates(
  vacStart: string,
  vacEnd: string,
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  if (!start) return false
  const e = end || start
  return start >= vacStart && e <= vacEnd
}

/**
 * Schlägt Urlaub und optional einen bestehenden Aufenthalt vor.
 */
export async function suggestStayMatch(
  db: D1Database,
  parsed: ParsedBookingFields
): Promise<StayMatchSuggestion | null> {
  const vacations = await getVacations(db)
  if (vacations.length === 0) return null

  const campingplaetze = await getCampingplaetze(db)
  let matchedCampingplatzId: string | null = null
  if (parsed.campingplatz_name) {
    const hit = campingplaetze.find(
      (cp) =>
        fuzzyIncludes(cp.name, parsed.campingplatz_name!) ||
        (parsed.campingplatz_ort && fuzzyIncludes(cp.ort, parsed.campingplatz_ort))
    )
    if (hit) matchedCampingplatzId = hit.id
  }

  type Scored = StayMatchSuggestion & { score: number }
  const candidates: Scored[] = []

  for (const v of vacations) {
    let score = 0
    if (
      vacationContainsDates(
        v.startdatum,
        v.enddatum,
        parsed.start_datum,
        parsed.end_datum
      )
    ) {
      score += 40
    } else if (parsed.start_datum) {
      if (parsed.start_datum >= v.startdatum && parsed.start_datum <= v.enddatum)
        score += 20
    }

    const stays = await getCampingStaysForVacation(db, v.id)
    let bestStay: (typeof stays)[0] | null = null
    let stayScore = 0

    for (const stay of stays) {
      let s = 0
      if (matchedCampingplatzId && stay.campingplatz_id === matchedCampingplatzId) s += 30
      else if (
        parsed.campingplatz_name &&
        fuzzyIncludes(stay.campingplatz.name, parsed.campingplatz_name)
      ) {
        s += 20
      }
      if (
        datesOverlap(parsed.start_datum, parsed.end_datum, stay.start_datum, stay.end_datum)
      ) {
        s += 25
      }
      if (s > stayScore) {
        stayScore = s
        bestStay = stay
      }
    }

    score += stayScore

    candidates.push({
      urlaub_id: v.id,
      urlaub_titel: v.titel,
      stay_id: bestStay?.id ?? null,
      campingplatz_id: bestStay?.campingplatz_id ?? matchedCampingplatzId,
      campingplatz_name: bestStay?.campingplatz.name ?? parsed.campingplatz_name ?? null,
      confidence: 'low',
      score,
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0]
  if (!top || top.score < 15) return null

  let confidence: StayMatchSuggestion['confidence'] = 'low'
  if (top.score >= 55) confidence = 'high'
  else if (top.score >= 30) confidence = 'medium'

  return {
    urlaub_id: top.urlaub_id,
    urlaub_titel: top.urlaub_titel,
    stay_id: top.stay_id,
    campingplatz_id: top.campingplatz_id,
    campingplatz_name: top.campingplatz_name,
    confidence,
  }
}
