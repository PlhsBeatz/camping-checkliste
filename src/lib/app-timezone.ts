/** Kalendertag für API, Webhooks und Integrations-Cron (nicht UTC des Workers). */
export const APP_TIMEZONE = 'Europe/Berlin'

const YMD_PREFIX = /^\d{4}-\d{2}-\d{2}/

export function todayInAppTimezone(now = new Date(), timeZone = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)
}

/** Kalenderdatum als YYYY-MM-DD (ohne UTC-Verschiebung bei reinen Datumsstrings). */
export function normalizeCalendarDate(d: string | Date): string {
  if (typeof d === 'string') {
    const trimmed = d.trim()
    const match = trimmed.match(YMD_PREFIX)
    if (match) return match[0]
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return ''
    return todayInAppTimezone(parsed)
  }
  return todayInAppTimezone(d)
}

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.slice(0, 10).split('-')
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) }
}

/** Kalendertage zwischen zwei YYYY-MM-DD-Werten (later − earlier). */
export function differenceCalendarDays(laterYmd: string, earlierYmd: string): number {
  const later = parseYmd(laterYmd)
  const earlier = parseYmd(earlierYmd)
  const laterMs = Date.UTC(later.y, later.m - 1, later.d)
  const earlierMs = Date.UTC(earlier.y, earlier.m - 1, earlier.d)
  return Math.round((laterMs - earlierMs) / 86_400_000)
}

export function addCalendarDays(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
