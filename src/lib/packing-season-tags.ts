import type { D1Database } from '@cloudflare/workers-types'
import type { Tag, TagKategorie } from '@/lib/db'

export type SeasonBucket = 'sommer' | 'winter' | 'uebergang'

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

const SEASON_HINTS: Record<SeasonBucket, string[]> = {
  sommer: ['sommer', 'sommerzeit', 'warm', 'hitze', 'badesaison'],
  winter: ['winter', 'winterzeit', 'kalt', 'frost', 'schnee'],
  uebergang: ['fruehling', 'frühling', 'herbst', 'uebergang', 'übergang', 'zwischen'],
}

export function pickSeasonTagIds(
  tags: Tag[],
  kategorien: TagKategorie[],
  season: SeasonBucket
): string[] {
  const zeitKatIds = new Set(
    kategorien
      .filter((k) => {
        const t = norm(k.titel)
        return t.includes('zeit') || t.includes('saison')
      })
      .map((k) => k.id)
  )
  const pool = zeitKatIds.size > 0 ? tags.filter((t) => zeitKatIds.has(t.tag_kategorie_id)) : tags
  const hints = SEASON_HINTS[season]
  return pool
    .filter((t) => {
      const hay = `${norm(t.titel)} ${norm(t.beschreibung ?? '')}`
      return hints.some((h) => hay.includes(h))
    })
    .map((t) => t.id)
}

export async function seasonTagIdsForVacation(
  db: D1Database,
  vacationId: string
): Promise<string[]> {
  const vac = await db
    .prepare('SELECT startdatum FROM urlaube WHERE id = ?')
    .bind(vacationId)
    .first<{ startdatum: string }>()
  const season = seasonFromYmd(vac?.startdatum)
  if (!season) return []
  const [tagsRes, katRes] = await Promise.all([
    db.prepare('SELECT * FROM tags').all<Tag>(),
    db.prepare('SELECT * FROM tag_kategorien').all<TagKategorie>(),
  ])
  return pickSeasonTagIds(tagsRes.results || [], katRes.results || [], season)
}
