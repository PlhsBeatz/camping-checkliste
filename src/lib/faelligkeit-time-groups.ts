/**
 * Zeitliche Gruppierung von Fälligkeiten für die Listenansicht.
 */
import type { Faelligkeit } from '@/lib/db'
import { todayInAppTimezone } from '@/lib/app-timezone'

export type FaelligkeitTimeBlock =
  | 'ueberfaellig'
  | 'this_month'
  | 'next_month'
  | 'this_year'
  | 'next_year'
  | 'later'
  | 'info'

export const FAELLIGKEIT_TIME_BLOCK_LABELS: Record<FaelligkeitTimeBlock, string> = {
  ueberfaellig: 'Überfällig',
  this_month: 'Diesen Monat fällig',
  next_month: 'Nächsten Monat fällig',
  this_year: 'Dieses Jahr fällig',
  next_year: 'Nächstes Jahr fällig',
  later: 'Später',
  info: 'Information',
}

const BLOCK_ORDER: FaelligkeitTimeBlock[] = [
  'ueberfaellig',
  'this_month',
  'next_month',
  'this_year',
  'next_year',
  'later',
  'info',
]

function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const parts = ymd.slice(0, 10).split('-')
  return { y: Number(parts[0]), m: Number(parts[1]), d: Number(parts[2]) }
}

function endOfMonthYmd(y: number, m: number): string {
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export function flattenFaelligkeitDashboard(items: {
  ueberfaellig: Faelligkeit[]
  bald_faellig: Faelligkeit[]
  ok: Faelligkeit[]
  nur_info: Faelligkeit[]
}): Faelligkeit[] {
  const seen = new Set<string>()
  const out: Faelligkeit[] = []
  for (const item of [
    ...items.ueberfaellig,
    ...items.bald_faellig,
    ...items.ok,
    ...items.nur_info,
  ]) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

export function groupFaelligkeitenByDuePeriod(
  items: Faelligkeit[],
  today = todayInAppTimezone()
): { block: FaelligkeitTimeBlock; items: Faelligkeit[] }[] {
  const { y: ty, m: tm } = parseYmd(today)
  const endThisMonth = endOfMonthYmd(ty, tm)

  const nextMonthIndex = ty * 12 + (tm - 1) + 1
  const ny = Math.floor(nextMonthIndex / 12)
  const nm = (nextMonthIndex % 12) + 1
  const startNextMonth = `${ny}-${String(nm).padStart(2, '0')}-01`
  const endNextMonth = endOfMonthYmd(ny, nm)
  const endThisYear = `${ty}-12-31`
  const endNextYear = `${ty + 1}-12-31`

  const buckets: Record<FaelligkeitTimeBlock, Faelligkeit[]> = {
    ueberfaellig: [],
    this_month: [],
    next_month: [],
    this_year: [],
    next_year: [],
    later: [],
    info: [],
  }

  for (const item of items) {
    const due = item.naechste_faelligkeit?.slice(0, 10) ?? null
    if (!due) {
      buckets.info.push(item)
      continue
    }
    if (due < today) {
      buckets.ueberfaellig.push(item)
    } else if (due <= endThisMonth) {
      buckets.this_month.push(item)
    } else if (due >= startNextMonth && due <= endNextMonth) {
      buckets.next_month.push(item)
    } else if (due <= endThisYear) {
      buckets.this_year.push(item)
    } else if (due <= endNextYear) {
      buckets.next_year.push(item)
    } else {
      buckets.later.push(item)
    }
  }

  const sortByDue = (a: Faelligkeit, b: Faelligkeit) =>
    (a.naechste_faelligkeit ?? '').localeCompare(b.naechste_faelligkeit ?? '')

  for (const block of BLOCK_ORDER) {
    buckets[block].sort(sortByDue)
  }

  return BLOCK_ORDER.filter((block) => buckets[block].length > 0).map((block) => ({
    block,
    items: buckets[block],
  }))
}
