import { addCalendarDays, differenceCalendarDays, normalizeCalendarDate } from '@/lib/app-timezone'

export const SAFETY_SNOOZE_FLOOR_DAYS = 21
export const SNOOZE_PRESET_DAYS = [1, 3, 7] as const
export type SnoozePresetDays = (typeof SNOOZE_PRESET_DAYS)[number]

export function isSnoozePresetDays(n: number): n is SnoozePresetDays {
  return n === 1 || n === 3 || n === 7
}

/** YYYY-MM-DD (Kalenderdatum). */
export function isSnoozeUntilYmd(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const n = normalizeCalendarDate(value.trim())
  return /^\d{4}-\d{2}-\d{2}$/.test(n)
}

/** Normalisiertes YYYY-MM-DD oder null. */
export function parseSnoozeUntilYmd(value: unknown): string | null {
  if (!isSnoozeUntilYmd(value)) return null
  return normalizeCalendarDate(value.trim())
}

export type SnoozeCapResult =
  | { allowed: false; reason: 'too_close' | 'overdue' | 'invalid' | 'past_due' }
  | { allowed: true; untilYmd: string }

export function isSafetySnoozeBlocked(dueYmd: string | null, todayYmd: string): boolean {
  if (!dueYmd) return false
  const due = normalizeCalendarDate(dueYmd)
  if (!due) return false
  const daysUntil = differenceCalendarDays(due, todayYmd)
  return daysUntil <= SAFETY_SNOOZE_FLOOR_DAYS
}

/** Ob Später für dieses Item grundsätzlich noch wählbar ist. */
export function isSnoozeAllowedForItem(opts: {
  todayYmd: string
  dueYmd: string | null
  sicherheitsrelevant: boolean
}): boolean {
  if (opts.sicherheitsrelevant) {
    return !isSafetySnoozeBlocked(opts.dueYmd, opts.todayYmd)
  }
  if (opts.dueYmd) {
    const due = normalizeCalendarDate(opts.dueYmd)
    if (due && due <= opts.todayYmd) return false
  }
  return true
}

/**
 * Obergrenze für snoozed_until (inkl.), oder `null` wenn keine Obergrenze.
 * Bei blockierter Sicherheitswartung: `null` (Snooze nicht erlaubt – siehe snoozeAllowed).
 */
export function maxSnoozeUntilYmd(opts: {
  todayYmd: string
  dueYmd: string | null
  sicherheitsrelevant: boolean
}): string | null {
  const today = normalizeCalendarDate(opts.todayYmd)
  if (!today) return null

  const due = opts.dueYmd ? normalizeCalendarDate(opts.dueYmd) : null

  if (opts.sicherheitsrelevant && due) {
    if (isSafetySnoozeBlocked(due, today)) return null
    const floorYmd = addCalendarDays(due, -SAFETY_SNOOZE_FLOOR_DAYS)
    return floorYmd > today ? floorYmd : null
  }

  if (due && due > today) return due
  return null
}

/**
 * Sicherheitsrelevante Fälligkeiten: Snooze endet spätestens 21 Tage vor dem Fälligkeitstag.
 * Ab D-21 und bei Überfälligkeit ist Snooze nicht erlaubt.
 * Items mit dueYmd: Snooze endet spätestens am Fälligkeitstag.
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

  const due = opts.dueYmd ? normalizeCalendarDate(opts.dueYmd) : null

  if (opts.sicherheitsrelevant && due) {
    const daysUntil = differenceCalendarDays(due, today)
    if (daysUntil < 0) return { allowed: false, reason: 'overdue' }
    if (daysUntil <= SAFETY_SNOOZE_FLOOR_DAYS) return { allowed: false, reason: 'too_close' }
  }

  let untilYmd = requested

  if (opts.sicherheitsrelevant && due) {
    const floorYmd = addCalendarDays(due, -SAFETY_SNOOZE_FLOOR_DAYS)
    if (untilYmd > floorYmd) untilYmd = floorYmd
  } else if (due) {
    if (due <= today) return { allowed: false, reason: 'past_due' }
    if (untilYmd > due) untilYmd = due
  }

  if (untilYmd <= today) {
    return {
      allowed: false,
      reason: opts.sicherheitsrelevant ? 'too_close' : 'past_due',
    }
  }
  return { allowed: true, untilYmd }
}
