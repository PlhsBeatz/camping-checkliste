import type { D1Database } from '@cloudflare/workers-types'
import { addCalendarDays, normalizeCalendarDate } from '@/lib/app-timezone'
import type { Tag, TagKategorie } from '@/lib/db'

export type SeasonBucket = 'sommer' | 'winter' | 'uebergang'

export const SEASON_BUCKET_LABEL: Record<SeasonBucket, string> = {
  sommer: 'Sommer',
  winter: 'Winter',
  uebergang: 'Übergang',
}

export function isSeasonBucket(v: string): v is SeasonBucket {
  return v === 'sommer' || v === 'winter' || v === 'uebergang'
}

export function formatSeasonBuckets(seasons: string[]): string {
  const labels = seasons.map((s) => (isSeasonBucket(s) ? SEASON_BUCKET_LABEL[s] : s))
  return labels.join('/')
}

/** Grobe Saison für Packlisten-Muster (nicht für Tag-Vorschläge). */
export function seasonFromMonth(month: number): SeasonBucket {
  if (month >= 5 && month <= 9) return 'sommer'
  if (month === 11 || month === 12 || month === 1 || month === 2) return 'winter'
  return 'uebergang'
}

export function seasonFromYmd(ymd: string | null | undefined): SeasonBucket | null {
  const m = Number((ymd ?? '').slice(5, 7))
  if (!Number.isFinite(m) || m < 1 || m > 12) return null
  return seasonFromMonth(m)
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const TIME_KAT_TOKENS = ['zeit', 'saison', 'season', 'jahreszeit', 'periode', 'period']

/** Meteorologische Fenster (Nordhalbkugel) plus frei konfigurierbare Tag-Titel. */
const SEASON_DEFS: Array<{ tokens: string[]; months: number[] }> = [
  { tokens: ['sommer', 'sommerzeit', 'badesaison'], months: [6, 7, 8] },
  { tokens: ['winter', 'winterzeit', 'schnee', 'frost'], months: [12, 1, 2] },
  { tokens: ['herbst', 'herbstzeit'], months: [9, 10, 11] },
  { tokens: ['fruehling', 'fruehjahr'], months: [3, 4, 5] },
  { tokens: ['uebergang'], months: [3, 4, 10, 11] },
]

const HOLIDAY_DEFS: Array<{ tokens: string[]; startMd: string; endMd: string }> = [
  { tokens: ['ostern'], startMd: '03-22', endMd: '04-25' },
  { tokens: ['pfingsten'], startMd: '05-08', endMd: '06-15' },
  { tokens: ['weihnachten'], startMd: '12-20', endMd: '12-27' },
  { tokens: ['silvester', 'neujahr'], startMd: '12-28', endMd: '01-06' },
]

function hasToken(hay: string, token: string): boolean {
  const n = norm(token)
  if (!hay || !n) return false
  if (hay === n) return true
  // Komposita im Titel (Sommersachen, Herbsturlaub) – keine kurzen Wortteile wie „warm“
  if (n.length >= 5 && hay.includes(n)) return true
  return false
}

function monthOf(ymd: string): number {
  return Number(ymd.slice(5, 7))
}

function mdOf(ymd: string): string {
  return ymd.slice(5, 10)
}

function mdInWindow(md: string, startMd: string, endMd: string): boolean {
  if (startMd <= endMd) return md >= startMd && md <= endMd
  return md >= startMd || md <= endMd
}

function eachYmd(startYmd: string, endYmd: string): string[] {
  const start = normalizeCalendarDate(startYmd)
  if (!start) return []
  const endRaw = normalizeCalendarDate(endYmd)
  const end = endRaw && endRaw >= start ? endRaw : start
  const out: string[] = []
  let cur = start
  for (let i = 0; i < 400; i++) {
    out.push(cur)
    if (cur >= end) break
    cur = addCalendarDays(cur, 1)
  }
  return out
}

function timeKategorieIds(kategorien: TagKategorie[]): Set<string> {
  return new Set(
    kategorien
      .filter((k) => {
        const t = norm(k.titel)
        return TIME_KAT_TOKENS.some((tok) => t.includes(tok))
      })
      .map((k) => k.id)
  )
}

function tagLooksLikeTime(tag: Tag): boolean {
  const title = norm(tag.titel)
  return (
    SEASON_DEFS.some((d) => d.tokens.some((tok) => hasToken(title, tok))) ||
    HOLIDAY_DEFS.some((d) => d.tokens.some((tok) => hasToken(title, tok)))
  )
}

function scoreTagForRange(tag: Tag, days: string[]): number {
  const title = norm(tag.titel)
  const desc = norm(tag.beschreibung ?? '')
  let best = 0

  for (const def of SEASON_DEFS) {
    const inTitle = def.tokens.some((tok) => hasToken(title, tok))
    const inDesc = !inTitle && def.tokens.some((tok) => hasToken(desc, tok))
    if (!inTitle && !inDesc) continue
    const monthSet = new Set(def.months)
    const overlap = days.filter((d) => monthSet.has(monthOf(d))).length
    if (overlap === 0) continue
    const weight = inTitle ? 3 : 1
    best = Math.max(best, overlap * weight)
  }

  for (const def of HOLIDAY_DEFS) {
    const inTitle = def.tokens.some((tok) => hasToken(title, tok))
    if (!inTitle) continue
    const overlap = days.filter((d) => mdInWindow(mdOf(d), def.startMd, def.endMd)).length
    if (overlap === 0) continue
    best = Math.max(best, overlap * 2)
  }

  return best
}

/**
 * Höchstens ein Zeit-/Saison-Tag für den Reisezeitraum.
 * Kategorie- und Tag-Namen sind frei konfigurierbar; ohne passende Kategorie
 * werden nur Tags mit saisonalem Titel betrachtet.
 */
export function pickBestTimeTagIds(
  tags: Tag[],
  kategorien: TagKategorie[],
  startYmd: string,
  endYmd?: string | null
): string[] {
  const days = eachYmd(startYmd, endYmd || startYmd)
  if (days.length === 0) return []

  const zeitKatIds = timeKategorieIds(kategorien)
  const pool =
    zeitKatIds.size > 0
      ? tags.filter((t) => zeitKatIds.has(t.tag_kategorie_id))
      : tags.filter(tagLooksLikeTime)

  let bestId: string | null = null
  let bestScore = 0
  for (const tag of pool) {
    const score = scoreTagForRange(tag, days)
    if (score > bestScore) {
      bestScore = score
      bestId = tag.id
    }
  }
  return bestId && bestScore > 0 ? [bestId] : []
}

/** @deprecated Nutzen Sie pickBestTimeTagIds mit Start-/Endedatum. */
export function pickSeasonTagIds(
  tags: Tag[],
  kategorien: TagKategorie[],
  season: SeasonBucket
): string[] {
  const mid: Record<SeasonBucket, string> = {
    sommer: '2000-07-15',
    winter: '2000-01-15',
    uebergang: '2000-10-15',
  }
  return pickBestTimeTagIds(tags, kategorien, mid[season], mid[season])
}

export async function seasonTagIdsForVacation(
  db: D1Database,
  vacationId: string
): Promise<string[]> {
  const vac = await db
    .prepare('SELECT startdatum, enddatum FROM urlaube WHERE id = ?')
    .bind(vacationId)
    .first<{ startdatum: string; enddatum: string | null }>()
  if (!vac?.startdatum) return []
  const [tagsRes, katRes] = await Promise.all([
    db.prepare('SELECT * FROM tags').all<Tag>(),
    db.prepare('SELECT * FROM tag_kategorien').all<TagKategorie>(),
  ])
  return pickBestTimeTagIds(
    tagsRes.results || [],
    katRes.results || [],
    vac.startdatum,
    vac.enddatum
  )
}
