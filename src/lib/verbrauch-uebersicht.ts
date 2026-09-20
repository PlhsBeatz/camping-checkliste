import type { VerbrauchMedium, VerbrauchMessung } from '@/lib/db'
import {
  differenceCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'
import { roundDecimals, verbrauchDifferenz } from '@/lib/verbrauch-format'

export const VERBRAUCH_UEBERSICHT_JAHRE = 5

export type VerbrauchUebersichtPunkt = {
  datum: string
  proTag: number
  label: string
}

export type VerbrauchUebersichtStats = {
  medium: VerbrauchMedium
  /** Gewichteter Durchschnitt (Summe Verbrauch / Summe Tage), oder null */
  durchschnittProTag: number | null
  punkte: VerbrauchUebersichtPunkt[]
  tripCount: number
}

function cutoffYmd(jahre = VERBRAUCH_UEBERSICHT_JAHRE): string {
  const today = todayInAppTimezone()
  const y = Number(today.slice(0, 4)) - jahre
  return `${y}${today.slice(4)}`
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

/** Abgeschlossene Messungen der letzten N Jahre für ein Medium. */
export function completedMessungenInWindow(
  medium: VerbrauchMedium,
  messungen: VerbrauchMessung[],
  jahre = VERBRAUCH_UEBERSICHT_JAHRE
): VerbrauchMessung[] {
  const cutoff = cutoffYmd(jahre)
  return messungen
    .filter((m) => {
      if (m.typ !== medium.schluessel) return false
      if (m.wert_start == null || m.wert_ende == null) return false
      const ende = m.messdatum_ende
        ? normalizeCalendarDate(m.messdatum_ende)
        : m.messdatum_start
          ? normalizeCalendarDate(m.messdatum_start)
          : null
      if (!ende || ende < cutoff) return false
      return true
    })
    .slice()
    .sort((a, b) => {
      const da = a.messdatum_ende || a.messdatum_start || a.created_at
      const db = b.messdatum_ende || b.messdatum_start || b.created_at
      return da.localeCompare(db)
    })
}

export function computeVerbrauchUebersicht(
  medium: VerbrauchMedium,
  messungen: VerbrauchMessung[],
  jahre = VERBRAUCH_UEBERSICHT_JAHRE
): VerbrauchUebersichtStats {
  const trips = completedMessungenInWindow(medium, messungen, jahre)

  let sumGesamt = 0
  let sumDays = 0
  const punkte: VerbrauchUebersichtPunkt[] = []

  for (const m of trips) {
    const gesamt = tripGesamt(m, medium)
    const days = tripDays(m)
    const proTag =
      m.verbrauch_pro_tag != null
        ? m.verbrauch_pro_tag
        : gesamt != null && days != null
          ? roundDecimals(gesamt / days, 2)
          : null

    if (gesamt != null && days != null) {
      sumGesamt += gesamt
      sumDays += days
    }

    if (proTag != null && proTag >= 0) {
      punkte.push({
        datum: normalizeCalendarDate(
          m.messdatum_ende || m.messdatum_start || m.created_at.slice(0, 10)
        ),
        proTag,
        label: m.urlaub_titel?.trim() || 'Urlaub',
      })
    }
  }

  return {
    medium,
    durchschnittProTag: sumDays > 0 ? roundDecimals(sumGesamt / sumDays, 2) : null,
    punkte,
    tripCount: trips.length,
  }
}

export function computeAlleVerbrauchUebersichten(
  medien: VerbrauchMedium[],
  messungen: VerbrauchMessung[],
  jahre = VERBRAUCH_UEBERSICHT_JAHRE
): VerbrauchUebersichtStats[] {
  return medien.map((m) => computeVerbrauchUebersicht(m, messungen, jahre))
}
