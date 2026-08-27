import type { D1Database } from '@cloudflare/workers-types'
import type { ParsedBookingFields } from './booking-types'
import type { Campingplatz } from './db'
import { getVacations, getCampingStaysForVacation, getCampingplaetze } from './db'

export type StayMatchSuggestion = {
  urlaub_id: string
  urlaub_titel: string
  stay_id: string | null
  campingplatz_id: string | null
  campingplatz_name: string | null
  confidence: 'high' | 'medium' | 'low'
  /** Datum aus bestehendem Aufenthalt, wenn Parser keine fand */
  suggested_start_datum?: string | null
  suggested_end_datum?: string | null
}

export type StayMatchContext = {
  betreff?: string | null
  absender?: string | null
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

/** Sucht Campingplatz-Namen im Betreff/Text (längster Treffer gewinnt). */
function findCampingplatzInText(
  text: string,
  campingplaetze: Campingplatz[]
): Campingplatz | null {
  const normalizedText = normalize(text)
  let best: Campingplatz | null = null
  let bestLen = 0
  for (const cp of campingplaetze) {
    const name = normalize(cp.name)
    if (name.length >= 4 && normalizedText.includes(name) && name.length > bestLen) {
      best = cp
      bestLen = name.length
    }
  }
  return best
}

/**
 * Schlägt Urlaub und optional einen bestehenden Aufenthalt vor.
 */
export async function suggestStayMatch(
  db: D1Database,
  parsed: ParsedBookingFields,
  context?: StayMatchContext
): Promise<StayMatchSuggestion | null> {
  const vacations = await getVacations(db)
  if (vacations.length === 0) return null

  const campingplaetze = await getCampingplaetze(db)
  const contextText = [context?.betreff, context?.absender].filter(Boolean).join('\n')

  let matchedCampingplatzId: string | null = null
  let matchedCampingplatzName: string | null = parsed.campingplatz_name ?? null

  if (parsed.campingplatz_name) {
    const hit = campingplaetze.find(
      (cp) =>
        fuzzyIncludes(cp.name, parsed.campingplatz_name!) ||
        (parsed.campingplatz_ort && fuzzyIncludes(cp.ort, parsed.campingplatz_ort))
    )
    if (hit) {
      matchedCampingplatzId = hit.id
      matchedCampingplatzName = hit.name
    }
  }

  if (!matchedCampingplatzId && contextText) {
    const fromContext = findCampingplatzInText(contextText, campingplaetze)
    if (fromContext) {
      matchedCampingplatzId = fromContext.id
      matchedCampingplatzName = fromContext.name
    }
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
      if (
        parsed.buchungsnummer &&
        stay.buchungsnummer &&
        parsed.buchungsnummer === stay.buchungsnummer
      ) {
        s += 50
      }
      if (matchedCampingplatzId && stay.campingplatz_id === matchedCampingplatzId) s += 35
      else if (
        matchedCampingplatzName &&
        fuzzyIncludes(stay.campingplatz.name, matchedCampingplatzName)
      ) {
        s += 25
      } else if (
        parsed.campingplatz_name &&
        fuzzyIncludes(stay.campingplatz.name, parsed.campingplatz_name)
      ) {
        s += 20
      } else if (contextText && fuzzyIncludes(contextText, stay.campingplatz.name)) {
        s += 22
      }

      if (
        datesOverlap(parsed.start_datum, parsed.end_datum, stay.start_datum, stay.end_datum)
      ) {
        s += 25
      } else if (
        !parsed.start_datum &&
        matchedCampingplatzId &&
        stay.campingplatz_id === matchedCampingplatzId &&
        stay.start_datum
      ) {
        // Campingplatz passt, Parser fand kein Datum – bestehender Aufenthalt reicht
        s += 18
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
      campingplatz_name: bestStay?.campingplatz.name ?? matchedCampingplatzName,
      suggested_start_datum:
        parsed.start_datum ?? bestStay?.start_datum ?? null,
      suggested_end_datum: parsed.end_datum ?? bestStay?.end_datum ?? null,
      confidence: 'low',
      score,
    })
  }

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0]
  if (!top || top.score < 12) return null

  let confidence: StayMatchSuggestion['confidence'] = 'low'
  if (top.score >= 55) confidence = 'high'
  else if (top.score >= 28) confidence = 'medium'

  return {
    urlaub_id: top.urlaub_id,
    urlaub_titel: top.urlaub_titel,
    stay_id: top.stay_id,
    campingplatz_id: top.campingplatz_id,
    campingplatz_name: top.campingplatz_name,
    suggested_start_datum: top.suggested_start_datum,
    suggested_end_datum: top.suggested_end_datum,
    confidence,
  }
}
