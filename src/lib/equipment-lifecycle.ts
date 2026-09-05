import { normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'

export type LifecycleDates = {
  created_at: string
  ausgemustert_am?: string | null
  anschaffungsdatum?: string | null
}

export type LifecycleFilterField = 'katalog' | 'ausgemustert' | 'angeschafft'
/** `all` = kein Jahresfilter; sonst Kalenderjahr des gewählten Datums */
export type LifecycleFilterYear = 'all' | number

/** Spalten der Lebensdauer – Export kommt per SELECT *, Import filtert per PRAGMA. */
export const AUSRUESTUNG_LIFECYCLE_COLUMNS = [
  'anschaffungsdatum',
  'ausgemustert_am',
  'ersetzt_durch_id',
] as const

const MODEL_STOPWORDS = new Set([
  'der',
  'die',
  'das',
  'und',
  'oder',
  'mit',
  'fuer',
  'von',
  'ein',
  'eine',
  'modell',
  'typ',
  'art',
  'nr',
  'no',
  'the',
  'and',
])

export function optionalCalendarYmd(value: unknown): string | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  return normalizeCalendarDate(raw) || null
}

export function anschaffungsjahr(anschaffungsdatum: string | null | undefined): string | null {
  const ymd = optionalCalendarYmd(anschaffungsdatum)
  return ymd ? ymd.slice(0, 4) : null
}

export function equipmentLifecycleDateYmd(
  item: LifecycleDates,
  field: LifecycleFilterField
): string | null {
  if (field === 'katalog') return optionalCalendarYmd(item.created_at)
  if (field === 'ausgemustert') return optionalCalendarYmd(item.ausgemustert_am)
  return optionalCalendarYmd(item.anschaffungsdatum)
}

export function matchesLifecycleFilter(
  item: LifecycleDates,
  year: LifecycleFilterYear,
  field: LifecycleFilterField
): boolean {
  if (year === 'all') return true
  const ymd = equipmentLifecycleDateYmd(item, field)
  if (!ymd) return false
  return ymd.startsWith(String(year))
}

/** Jahre aus Angelegt/Ausgemustert/Angeschafft, neueste zuerst. */
export function lifecycleYearsFromItems(
  items: LifecycleDates[],
  extraYear?: number
): number[] {
  const years = new Set<number>()
  if (extraYear != null && Number.isFinite(extraYear)) years.add(extraYear)
  for (const item of items) {
    for (const field of ['katalog', 'ausgemustert', 'angeschafft'] as const) {
      const ymd = equipmentLifecycleDateYmd(item, field)
      if (!ymd) continue
      const y = Number(ymd.slice(0, 4))
      if (Number.isFinite(y)) years.add(y)
    }
  }
  return [...years].sort((a, b) => b - a)
}

function normalizeDetails(details: string): string {
  return details
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractModelTokens(details: string): string[] {
  const text = normalizeDetails(details)
  if (!text) return []
  const tokens = text.split(/[^a-z0-9]+/).filter((t) => {
    if (t.length < 3) return false
    if (MODEL_STOPWORDS.has(t)) return false
    return /\d/.test(t) || t.length >= 5
  })
  return [...new Set(tokens)]
}

/** Gleiches Modell nur, wenn neue Details zum alten Modell passen. */
export function looksLikeSameModel(oldDetails: string, newDetails: string): boolean {
  const oldNorm = normalizeDetails(oldDetails)
  const newNorm = normalizeDetails(newDetails)
  if (!oldNorm || !newNorm) return false
  if (oldNorm === newNorm) return true
  const oldTokens = extractModelTokens(oldDetails)
  const newTokens = extractModelTokens(newDetails)
  if (oldTokens.length === 0 || newTokens.length === 0) return false
  const oldDigits = oldTokens.filter((t) => /\d/.test(t))
  const newDigits = newTokens.filter((t) => /\d/.test(t))
  if (oldDigits.some((t) => newDigits.includes(t))) return true
  const shared = newTokens.filter((t) => oldTokens.includes(t))
  return shared.length >= 2
}

export function shouldCopyWeightOnReplace(oldDetails: string, newDetails: string): boolean {
  return looksLikeSameModel(oldDetails, newDetails)
}

export function defaultAnschaffungsdatumOnCreate(): string {
  return todayInAppTimezone()
}

export function formatAngelegtAm(createdAt: string | null | undefined): string | null {
  const ymd = optionalCalendarYmd(createdAt)
  if (!ymd) return null
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return null
  return `${d}.${m}.${y}`
}
