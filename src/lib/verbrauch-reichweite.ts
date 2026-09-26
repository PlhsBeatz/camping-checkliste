import type { VerbrauchMedium, VerbrauchMessung } from '@/lib/db'
import {
  differenceCalendarDays,
  normalizeCalendarDate,
} from '@/lib/app-timezone'
import { roundDecimals, verbrauchDifferenz } from '@/lib/verbrauch-format'
import {
  completedMessungenInWindow,
  VERBRAUCH_UEBERSICHT_JAHRE,
} from '@/lib/verbrauch-uebersicht'
import {
  climateProxyTempForYmd,
  KLIMA_TEMP_DELTA_MAX_C,
  midYmdBetween,
} from '@/lib/verbrauch-klima'
import { formatVerbrauchMitEinheit } from '@/lib/verbrauch-format'

export type ReichweiteAmpel = 'ok' | 'eng' | 'kritisch'

export type VerbrauchRateStats = {
  avgProTag: number | null
  minProTag: number | null
  maxProTag: number | null
  tripCount: number
  /** true wenn Temperaturfilter/Korrektur angewendet wurde */
  seasonal: boolean
}

export type ReichweiteBewertung = {
  ampel: ReichweiteAmpel
  verfuegbar: number
  days: number
  bedarfAvg: number
  bedarfMin: number
  bedarfMax: number
  avgProTag: number
  minProTag: number
  maxProTag: number
  einheit: string
  mediumName: string
  mediumSchluessel: string
  title: string
  reason: string
  risk: string | null
}

function tripDays(m: VerbrauchMessung): number | null {
  if (!m.messdatum_start || !m.messdatum_ende) return null
  const start = normalizeCalendarDate(m.messdatum_start)
  const end = normalizeCalendarDate(m.messdatum_ende)
  return Math.max(1, differenceCalendarDays(end, start) + 1)
}

function tripGesamt(m: VerbrauchMessung, medium: VerbrauchMedium): number | null {
  if (m.wert_start == null || m.wert_ende == null) return null
  if (m.verbrauch_gesamt != null) return m.verbrauch_gesamt
  const auffuellungen =
    medium.messmodus === 'abnahme' ? (m.auffuellungen_summe ?? 0) : 0
  return verbrauchDifferenz(m.wert_start, m.wert_ende, medium.messmodus, auffuellungen)
}

function tripProTag(m: VerbrauchMessung, medium: VerbrauchMedium): number | null {
  if (m.verbrauch_pro_tag != null) return m.verbrauch_pro_tag
  const gesamt = tripGesamt(m, medium)
  const days = tripDays(m)
  if (gesamt == null || days == null) return null
  return roundDecimals(gesamt / days, 2)
}

/** Kalendertage inkl. Start und Ende (wie verbrauch_pro_tag). */
export function reichweiteReiseTage(vacation: {
  startdatum: string
  enddatum?: string | null
  abfahrtdatum?: string | null
}): number {
  const start = normalizeCalendarDate(
    vacation.abfahrtdatum?.trim() || vacation.startdatum
  )
  const end = normalizeCalendarDate(vacation.enddatum?.trim() || vacation.startdatum)
  return Math.max(1, differenceCalendarDays(end, start) + 1)
}

/**
 * Verfügbare Menge: Startstand der Urlaubs-Messung, sonst Endstand der letzten
 * abgeschlossenen Messung desselben Mediums.
 */
export function resolveVerfuegbareMenge(
  mediumSchluessel: string,
  messungen: VerbrauchMessung[],
  urlaubId: string
): number | null {
  const forMedium = messungen.filter((m) => m.typ === mediumSchluessel)

  const current = forMedium.find((m) => m.urlaub_id === urlaubId)
  if (current && current.wert_start != null && Number.isFinite(current.wert_start)) {
    return current.wert_start
  }

  const completed = forMedium
    .filter((m) => m.wert_ende != null && Number.isFinite(m.wert_ende))
    .filter((m) => m.urlaub_id !== urlaubId)
    .slice()
    .sort((a, b) => {
      const da = a.messdatum_ende || a.messdatum_start || a.created_at
      const db = b.messdatum_ende || b.messdatum_start || b.created_at
      return db.localeCompare(da)
    })

  const last = completed[0]
  if (last && last.wert_ende != null) return last.wert_ende
  return null
}

type RatePoint = {
  proTag: number
  days: number
  tempC: number | null
}

function ratesFromMessungen(
  medium: VerbrauchMedium,
  messungen: VerbrauchMessung[],
  opts?: {
    urlaubTempById?: Map<string, number>
    plannedTempC?: number | null
    useSeasonalFilter?: boolean
  }
): VerbrauchRateStats {
  const useSeasonal = !!opts?.useSeasonalFilter
  const plannedT = opts?.plannedTempC
  const window = completedMessungenInWindow(medium, messungen, VERBRAUCH_UEBERSICHT_JAHRE)

  const points: RatePoint[] = []
  for (const m of window) {
    const proTag = tripProTag(m, medium)
    const days = tripDays(m)
    if (proTag == null || days == null || proTag < 0) continue
    const tempC =
      m.urlaub_id && opts?.urlaubTempById
        ? (opts.urlaubTempById.get(m.urlaub_id) ?? null)
        : null
    points.push({ proTag, days, tempC })
  }

  let filtered = points
  if (useSeasonal && plannedT != null && Number.isFinite(plannedT)) {
    filtered = points.filter((p) => {
      if (p.tempC == null) return false
      return Math.abs(p.tempC - plannedT) <= KLIMA_TEMP_DELTA_MAX_C
    })
  }

  if (filtered.length === 0) {
    return {
      avgProTag: null,
      minProTag: null,
      maxProTag: null,
      tripCount: 0,
      seasonal: useSeasonal,
    }
  }

  let sumGesamt = 0
  let sumDays = 0
  let min = Infinity
  let max = -Infinity
  for (const p of filtered) {
    sumGesamt += p.proTag * p.days
    sumDays += p.days
    min = Math.min(min, p.proTag)
    max = Math.max(max, p.proTag)
  }

  let avg = sumDays > 0 ? sumGesamt / sumDays : null

  // Temperaturkorrektur: lineare Regression proTag ~ T
  if (
    useSeasonal &&
    plannedT != null &&
    filtered.length >= 4 &&
    filtered.every((p) => p.tempC != null)
  ) {
    const temps = filtered.map((p) => p.tempC as number)
    const tMin = Math.min(...temps)
    const tMax = Math.max(...temps)
    if (tMax - tMin >= 2) {
      let sumT = 0
      let sumY = 0
      let sumTT = 0
      let sumTY = 0
      const n = filtered.length
      for (const p of filtered) {
        const t = p.tempC as number
        sumT += t
        sumY += p.proTag
        sumTT += t * t
        sumTY += t * p.proTag
      }
      const denom = n * sumTT - sumT * sumT
      if (Math.abs(denom) > 1e-9) {
        const slope = (n * sumTY - sumT * sumY) / denom
        const intercept = (sumY - slope * sumT) / n
        const predicted = intercept + slope * plannedT
        if (Number.isFinite(predicted) && predicted >= 0) {
          avg = predicted
        }
      }
    }
  }

  return {
    avgProTag: avg != null ? roundDecimals(avg, 2) : null,
    minProTag: Number.isFinite(min) ? roundDecimals(min, 2) : null,
    maxProTag: Number.isFinite(max) ? roundDecimals(max, 2) : null,
    tripCount: filtered.length,
    seasonal: useSeasonal,
  }
}

export function computeVerbrauchRateStats(
  medium: VerbrauchMedium,
  messungen: VerbrauchMessung[],
  opts?: {
    urlaubTempById?: Map<string, number>
    plannedTempC?: number | null
  }
): VerbrauchRateStats {
  const seasonal = medium.schluessel === 'petroleum'
  if (seasonal) {
    const seasonalStats = ratesFromMessungen(medium, messungen, {
      ...opts,
      useSeasonalFilter: true,
    })
    if (seasonalStats.avgProTag != null) return seasonalStats
    // Fallback: alle Reisen im Fenster ohne Temperaturfilter
    return ratesFromMessungen(medium, messungen, { useSeasonalFilter: false })
  }
  return ratesFromMessungen(medium, messungen, { useSeasonalFilter: false })
}

export function isVerbrauchMediumRelevant(
  mediumId: string,
  links: Array<{ medium_id: string; equipment_id: string; status: string }>,
  packingGegenstandIds: Set<string>
): boolean {
  const mediumLinks = links.filter((l) => l.medium_id === mediumId)
  if (mediumLinks.length === 0) return false
  return mediumLinks.some(
    (l) =>
      packingGegenstandIds.has(l.equipment_id) ||
      l.status.trim() === 'Fest Installiert'
  )
}

export function evaluateReichweite(opts: {
  medium: VerbrauchMedium
  verfuegbar: number
  days: number
  stats: VerbrauchRateStats
}): ReichweiteBewertung | null {
  const { medium, verfuegbar, days, stats } = opts
  if (
    stats.avgProTag == null ||
    stats.minProTag == null ||
    stats.maxProTag == null ||
    !(days > 0) ||
    !Number.isFinite(verfuegbar)
  ) {
    return null
  }

  const bedarfAvg = roundDecimals(stats.avgProTag * days, 2)
  const bedarfMin = roundDecimals(stats.minProTag * days, 2)
  const bedarfMax = roundDecimals(stats.maxProTag * days, 2)

  let ampel: ReichweiteAmpel = 'ok'
  if (verfuegbar < bedarfAvg) ampel = 'kritisch'
  else if (verfuegbar < bedarfMax) ampel = 'eng'

  const einheit = medium.einheit
  const vFmt = formatVerbrauchMitEinheit(verfuegbar, einheit, 2)
  const avgFmt = formatVerbrauchMitEinheit(bedarfAvg, einheit, 2)
  const maxFmt = formatVerbrauchMitEinheit(bedarfMax, einheit, 2)

  if (ampel === 'ok') {
    return {
      ampel,
      verfuegbar,
      days,
      bedarfAvg,
      bedarfMin,
      bedarfMax,
      avgProTag: stats.avgProTag,
      minProTag: stats.minProTag,
      maxProTag: stats.maxProTag,
      einheit,
      mediumName: medium.name,
      mediumSchluessel: medium.schluessel,
      title: `${medium.name} reicht`,
      reason: `Startstand ${vFmt}`,
      risk: null,
    }
  }

  if (ampel === 'eng') {
    return {
      ampel,
      verfuegbar,
      days,
      bedarfAvg,
      bedarfMin,
      bedarfMax,
      avgProTag: stats.avgProTag,
      minProTag: stats.minProTag,
      maxProTag: stats.maxProTag,
      einheit,
      mediumName: medium.name,
      mediumSchluessel: medium.schluessel,
      title: `${medium.name}: knapp bei hohem Verbrauch`,
      reason: `Typisch ~${avgFmt}, bis ${maxFmt} bei hohem Verbrauch · Startstand ${vFmt}`,
      risk: 'Unter ungünstigen Bedingungen könnte die Menge nicht reichen.',
    }
  }

  return {
    ampel,
    verfuegbar,
    days,
    bedarfAvg,
    bedarfMin,
    bedarfMax,
    avgProTag: stats.avgProTag,
    minProTag: stats.minProTag,
    maxProTag: stats.maxProTag,
    einheit,
    mediumName: medium.name,
    mediumSchluessel: medium.schluessel,
    title: `${medium.name}: Startstand erhöhen`,
    reason: `Typisch ~${avgFmt} nötig, bis ${maxFmt} · Startstand ${vFmt}`,
    risk: 'Der aktuelle Stand reicht voraussichtlich nicht für die Reisedauer.',
  }
}

/** Hilfsfunktion: Temperatur für einen Urlaub aus längstem Stay + Lat. */
export function plannedTempForVacation(opts: {
  startdatum: string
  enddatum: string
  lat: number | null
}): number {
  const mid = midYmdBetween(opts.startdatum, opts.enddatum)
  return climateProxyTempForYmd(mid, opts.lat)
}

export { climateProxyTempForYmd, midYmdBetween }
