/**
 * Push-Erinnerung: fehlende Verbrauchs-Endstände nach Heimkehr.
 * Cron: erster Tag nach Urlaubsende.
 * Client: GPS-Ankunft auf der Rückfahrt (API markiert ebenfalls „sent“).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { todayInAppTimezone } from '@/lib/app-timezone'
import {
  getOpenVerbrauchEndstandMessungen,
  getVacations,
  isVerbrauchEndstandPushSent,
  markVerbrauchEndstandPushSent,
} from '@/lib/db'
import { buildVerbrauchEndstandPush } from '@/lib/push-notifications'
import { sendPushToUser } from '@/lib/web-push'
import {
  findVacationsForEndstandReminder,
  formatEndstandMediaList,
  isFirstDayHomeAfterVacation,
} from '@/lib/verbrauch-endstand'

async function listUsersWithVerbrauchEndstandPush(db: D1Database): Promise<string[]> {
  try {
    const res = await db
      .prepare(
        `SELECT u.id AS id
         FROM users u
         WHERE u.push_notifications_enabled = 1
           AND COALESCE(u.push_verbrauch_endstand, 1) != 0
           AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)`
      )
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  } catch {
    try {
      const res = await db
        .prepare(
          `SELECT u.id AS id
           FROM users u
           WHERE u.push_notifications_enabled = 1
             AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)`
        )
        .all<{ id: string }>()
      return (res.results || []).map((r) => r.id)
    } catch {
      return []
    }
  }
}

export type VerbrauchEndstandNotifyResult = {
  notified: boolean
  alreadySent: boolean
  mediaNames: string[]
  pushes: number
}

/** Ein Urlaub: Push an Empfänger, Flag setzen. */
export async function notifyVerbrauchEndstandForVacation(
  db: D1Database,
  opts: {
    urlaubId: string
    urlaubTitel: string
    /** null = alle User mit Präferenz (Cron); gesetzt = nur dieser User (Client). */
    userId?: string | null
    force?: boolean
  }
): Promise<VerbrauchEndstandNotifyResult> {
  const open = await getOpenVerbrauchEndstandMessungen(db, [opts.urlaubId])
  if (open.length === 0) {
    return { notified: false, alreadySent: false, mediaNames: [], pushes: 0 }
  }

  if (!opts.force && (await isVerbrauchEndstandPushSent(db, opts.urlaubId))) {
    return {
      notified: false,
      alreadySent: true,
      mediaNames: open.map((m) => m.medium_name),
      pushes: 0,
    }
  }

  const mediaNames = [...new Set(open.map((m) => m.medium_name))]
  const payload = buildVerbrauchEndstandPush({
    urlaubId: opts.urlaubId,
    urlaubTitel: opts.urlaubTitel,
    mediaNames,
  })

  const recipients = opts.userId
    ? [opts.userId]
    : await listUsersWithVerbrauchEndstandPush(db)

  let pushes = 0
  for (const userId of recipients) {
    const result = await sendPushToUser(db, userId, payload)
    pushes += result.sent
  }

  await markVerbrauchEndstandPushSent(db, opts.urlaubId)
  return {
    notified: pushes > 0 || recipients.length > 0,
    alreadySent: false,
    mediaNames,
    pushes,
  }
}

export async function processVerbrauchEndstandPush(
  db: D1Database
): Promise<{ checked: number; notified: number; pushes: number }> {
  const today = todayInAppTimezone()
  const vacations = await getVacations(db)
  const candidates = findVacationsForEndstandReminder(vacations, today).filter((v) =>
    isFirstDayHomeAfterVacation(v, today)
  )

  let notified = 0
  let pushes = 0
  for (const v of candidates) {
    const result = await notifyVerbrauchEndstandForVacation(db, {
      urlaubId: v.id,
      urlaubTitel: v.titel,
    })
    if (result.notified && !result.alreadySent) notified += 1
    pushes += result.pushes
  }

  return { checked: candidates.length, notified, pushes }
}

export { formatEndstandMediaList }
