import {
  addCalendarDays,
  differenceCalendarDays,
  normalizeCalendarDate,
} from '@/lib/app-timezone'

/** Anreise gleich, Abreise in der Buchung genau 1 Tag nach geplantem Aufenthalt. */
export function isExtraDepartureDayBooking(
  stayStart: string | null | undefined,
  stayEnd: string | null | undefined,
  importStart: string | null | undefined,
  importEnd: string | null | undefined
): boolean {
  if (!stayStart?.trim() || !stayEnd?.trim() || !importStart?.trim() || !importEnd?.trim()) {
    return false
  }
  const stayStartYmd = normalizeCalendarDate(stayStart)
  const stayEndYmd = normalizeCalendarDate(stayEnd)
  const importStartYmd = normalizeCalendarDate(importStart)
  const importEndYmd = normalizeCalendarDate(importEnd)
  if (!stayStartYmd || !stayEndYmd || !importStartYmd || !importEndYmd) return false
  if (stayStartYmd !== importStartYmd) return false
  return importEndYmd === addCalendarDays(stayEndYmd, 1)
}

export function formatCalendarDateDe(ymd: string | null | undefined): string {
  if (!ymd?.trim()) return '—'
  const normalized = normalizeCalendarDate(ymd)
  const [y, m, d] = normalized.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatStayDateRangeDe(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  if (!start?.trim() && !end?.trim()) return '—'
  if (start?.trim() && end?.trim()) {
    return `${formatCalendarDateDe(start)} – ${formatCalendarDateDe(end)}`
  }
  return formatCalendarDateDe(start ?? end)
}

/** Kalendertage zwischen Import-Ende und Aufenthalts-Ende (positiv = Import später). */
export function importEndDayOffset(
  stayEnd: string | null | undefined,
  importEnd: string | null | undefined
): number | null {
  if (!stayEnd?.trim() || !importEnd?.trim()) return null
  return differenceCalendarDays(normalizeCalendarDate(importEnd), normalizeCalendarDate(stayEnd))
}
