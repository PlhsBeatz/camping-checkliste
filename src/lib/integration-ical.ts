import type { D1Database } from '@cloudflare/workers-types'
import { getCampingStaysForVacations, getVacations } from '@/lib/db'
import {
  ICAL_FEED_META,
  buildVacationsIcs,
  icalFeedKey,
  type IcalFeedKey,
  type IcalView,
} from '@/lib/ical-vacations'

export async function getCachedIcalBody(
  db: D1Database,
  feedKey: IcalFeedKey
): Promise<string | null> {
  try {
    const row = await db
      .prepare('SELECT body FROM integration_ical_cache WHERE feed_key = ?')
      .bind(feedKey)
      .first<{ body: string }>()
    const body = row?.body?.trim()
    return body ? body : null
  } catch (error) {
    console.warn('getCachedIcalBody failed:', error)
    return null
  }
}

async function upsertIcalBody(db: D1Database, feedKey: IcalFeedKey, body: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO integration_ical_cache (feed_key, body, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(feed_key) DO UPDATE SET
         body = excluded.body,
         updated_at = excluded.updated_at`
    )
    .bind(feedKey, body)
    .run()
}

/** Baut alle vier Feeds; ersetzt je Key nur bei Erfolg den last-good Stand. */
export async function refreshAllIcalCaches(db: D1Database): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0
  try {
    const vacations = await getVacations(db)
    const staysByVacationId = await getCampingStaysForVacations(
      db,
      vacations.map((v) => v.id)
    )

    for (const meta of ICAL_FEED_META) {
      try {
        const body = buildVacationsIcs({
          vacations,
          staysByVacationId,
          view: meta.view,
          includeDeparture: meta.includeDeparture,
          calendarName: meta.calendarName,
        })
        await upsertIcalBody(db, meta.feedKey, body)
        ok++
      } catch (error) {
        failed++
        console.warn(`refreshAllIcalCaches: feed ${meta.feedKey} failed, keeping previous:`, error)
      }
    }
  } catch (error) {
    failed += ICAL_FEED_META.length - ok
    console.warn('refreshAllIcalCaches failed, keeping previous caches:', error)
  }
  return { ok, failed }
}

/** Für Mutation-Hooks: Fehler schlucken, Vacation-Request nicht gefährden. */
export async function refreshAllIcalCachesSafe(
  db: D1Database,
  context = 'ical-refresh'
): Promise<void> {
  try {
    await refreshAllIcalCaches(db)
  } catch (error) {
    console.warn(`${context}:`, error)
  }
}

/**
 * Liefert den ICS-Body für view/includeDeparture.
 * Nutzt Cache; bei leerem Cache einmalig bauen und speichern (Fallback).
 */
export async function getOrBuildIcalBody(
  db: D1Database,
  view: IcalView,
  includeDeparture: boolean
): Promise<string> {
  const feedKey = icalFeedKey(view, includeDeparture)
  const cached = await getCachedIcalBody(db, feedKey)
  if (cached) return cached

  const vacations = await getVacations(db)
  const staysByVacationId = await getCampingStaysForVacations(
    db,
    vacations.map((v) => v.id)
  )
  const meta = ICAL_FEED_META.find((m) => m.feedKey === feedKey)
  const body = buildVacationsIcs({
    vacations,
    staysByVacationId,
    view,
    includeDeparture,
    calendarName: meta?.calendarName,
  })
  try {
    await upsertIcalBody(db, feedKey, body)
  } catch (error) {
    console.warn('getOrBuildIcalBody: cache write failed:', error)
  }
  return body
}
