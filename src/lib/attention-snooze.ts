import { addCalendarDays, differenceCalendarDays, normalizeCalendarDate } from '@/lib/app-timezone'

export const SAFETY_SNOOZE_FLOOR_DAYS = 21
export const SNOOZE_PRESET_DAYS = [1, 3, 7] as const
export type SnoozePresetDays = (typeof SNOOZE_PRESET_DAYS)[number]

export function isSnoozePresetDays(n: number): n is SnoozePresetDays {
  return n === 1 || n === 3 || n === 7
}

export type SnoozeCapResult =
  | { allowed: false; reason: 'too_close' | 'overdue' | 'invalid' }
  | { allowed: true; untilYmd: string }

export function isSafetySnoozeBlocked(dueYmd: string | null, todayYmd: string): boolean {
  if (!dueYmd) return false
  const due = normalizeCalendarDate(dueYmd)
  if (!due) return false
  const daysUntil = differenceCalendarDays(due, todayYmd)
  return daysUntil <= SAFETY_SNOOZE_FLOOR_DAYS
}

/**
 * Sicherheitsrelevante Fälligkeiten: Snooze endet spätestens 21 Tage vor dem Fälligkeitstag.
 * Ab D-21 und bei Überfälligkeit ist Snooze nicht erlaubt.
 */
export function capSnoozeUntil(opts: {
  todayYmd: string
  requestedUntilYmd: string
  dueYmd: string | null
  sicherheitsrelevant: boolean
}): SnoozeCapResult {
  const today = normalizeCalendarDate(opts.todayYmd)
  const requested = normalizeCalendarDate(opts.requestedUntilYmd)
  if (!today || !requested) return { allowed: false, reason: 'invalid' }
  if (requested <= today) return { allowed: false, reason: 'invalid' }

  if (!opts.sicherheitsrelevant || !opts.dueYmd) {
    return { allowed: true, untilYmd: requested }
  }

  const due = normalizeCalendarDate(opts.dueYmd)
  if (!due) return { allowed: true, untilYmd: requested }

  const daysUntil = differenceCalendarDays(due, today)
  if (daysUntil < 0) return { allowed: false, reason: 'overdue' }
  if (daysUntil <= SAFETY_SNOOZE_FLOOR_DAYS) return { allowed: false, reason: 'too_close' }

  const floorYmd = addCalendarDays(due, -SAFETY_SNOOZE_FLOOR_DAYS)
  const untilYmd = requested < floorYmd ? requested : floorYmd
  if (untilYmd <= today) return { allowed: false, reason: 'too_close' }
  return { allowed: true, untilYmd }
}
