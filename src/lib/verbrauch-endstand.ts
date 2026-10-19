import {
  addCalendarDays,
  differenceCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'
import type { Vacation } from '@/lib/db'
import type { VerbrauchMessung } from '@/lib/db-verbrauch'
import { haversineDistanceKm } from '@/lib/routes'
import type { GeoPoint } from '@/lib/sonnen-hub-arrival'
import { isReturnHomeSegment, type TravelSegment } from '@/lib/travel-segment'

/** Nachbereitung: Endstände bis so viele Tage nach Urlaubsende erinnern. */
export const VERBRAUCH_ENDSTAND_REMINDER_DAYS = 7

/** GPS: als „zuhause angekommen“ gelten (Rückfahrt). */
export const VERBRAUCH_ENDSTAND_HOME_ARRIVAL_KM = 2.5

/** Endstand erst am letzten Urlaubstag oder danach. */
export function canEnterVerbrauchEndstand(
  endRaw: string | null | undefined,
  todayYmd: string = todayInAppTimezone()
): boolean {
  if (!endRaw?.trim()) return false
  return normalizeCalendarDate(endRaw) <= todayYmd
}

export function isOpenVerbrauchMessung(m: VerbrauchMessung): boolean {
  return m.wert_start != null && Number.isFinite(m.wert_start) && m.wert_ende == null
}

/** Offene Startstände ohne Endstand für einen Urlaub. */
export function openEndstandMessungenForVacation(
  messungen: VerbrauchMessung[],
  urlaubId: string
): VerbrauchMessung[] {
  return messungen.filter((m) => m.urlaub_id === urlaubId && isOpenVerbrauchMessung(m))
}

/**
 * Kürzlich beendete / am letzten Tag befindliche Urlaube (für Hub-Karte).
 * Unabhängig vom nächsten geplanten Urlaub.
 */
export function findVacationsForEndstandReminder(
  vacations: Vacation[],
  todayYmd: string = todayInAppTimezone()
): Vacation[] {
  const cutoff = addCalendarDays(todayYmd, -VERBRAUCH_ENDSTAND_REMINDER_DAYS)
  return vacations
    .filter((v) => {
      const end = normalizeCalendarDate(v.enddatum)
      return end <= todayYmd && end >= cutoff
    })
    .sort((a, b) =>
      normalizeCalendarDate(b.enddatum).localeCompare(normalizeCalendarDate(a.enddatum))
    )
}

/** Erster Kalendertag nach Urlaubsende (Cron-Push). */
export function isFirstDayHomeAfterVacation(
  vacation: Pick<Vacation, 'enddatum'>,
  todayYmd: string = todayInAppTimezone()
): boolean {
  const end = normalizeCalendarDate(vacation.enddatum)
  return differenceCalendarDays(todayYmd, end) === 1
}

export function hasArrivedHomeForEndstand(opts: {
  position: GeoPoint | null
  homeCoords: GeoPoint | null
  activeSegment: TravelSegment | null
}): boolean {
  if (!opts.position || !opts.homeCoords || !opts.activeSegment) return false
  if (!isReturnHomeSegment(opts.activeSegment)) return false
  const distKm = haversineDistanceKm({
    lat1: opts.position.lat,
    lng1: opts.position.lng,
    lat2: opts.homeCoords.lat,
    lng2: opts.homeCoords.lng,
  })
  return distKm <= VERBRAUCH_ENDSTAND_HOME_ARRIVAL_KM
}

export function formatEndstandMediaList(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (unique.length === 0) return 'Verbrauch'
  if (unique.length === 1) return unique[0]!
  if (unique.length === 2) return `${unique[0]} und ${unique[1]}`
  return `${unique.slice(0, -1).join(', ')} und ${unique[unique.length - 1]}`
}
