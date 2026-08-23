import {
  differenceCalendarDays,
  normalizeCalendarDate,
  todayInAppTimezone,
} from '@/lib/app-timezone'
import type { Vacation } from '@/lib/db'
import { findRelevantVacation, getDepartureDate, getTripPhase } from '@/lib/trip-readiness'

/** Nächster Start muss weiter weg sein als diese Lücke, sonst zählt die Reisephase. */
export const WINTERPAUSE_GAP_DAYS = 42

/** Weiches Default-Fenster: 1. Nov bis 15. März (inklusive). */
export function isInWinterWindow(ymd: string): boolean {
  const mmdd = normalizeCalendarDate(ymd).slice(5, 10)
  if (!mmdd || mmdd.length < 5) return false
  return mmdd >= '11-01' || mmdd <= '03-15'
}

/**
 * Winterpause nur als Hub-Rahmen: nie bei relevanter Reisephase,
 * nur bei Lücke + Winterfenster.
 */
export function isWinterpause(vacations: Vacation[], now = new Date()): boolean {
  const today = todayInAppTimezone(now)
  if (!isInWinterWindow(today)) return false

  const relevant = findRelevantVacation(vacations, now)
  if (!relevant) return true

  const phase = getTripPhase(relevant, 3, now)
  if (
    phase === 'on_trip' ||
    phase === 'departure_day' ||
    phase === 'departure_approaching' ||
    phase === 'returned'
  ) {
    return false
  }

  const departure = normalizeCalendarDate(getDepartureDate(relevant))
  if (!departure) return true
  return differenceCalendarDays(departure, today) > WINTERPAUSE_GAP_DAYS
}
