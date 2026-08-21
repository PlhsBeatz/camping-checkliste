/**
 * Tägliche Push-Erinnerungen für Optimierungen (4 und 2 Wochen vor faellig_am).
 * Mehrere fällige Einträge → eine Sammel-Benachrichtigung pro Reminder-Abstand.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  differenceCalendarDays,
  todayInAppTimezone,
} from '@/lib/app-timezone'
import { buildOptimierungDuePush } from '@/lib/push-notifications'
import { sendPushToUser } from '@/lib/web-push'
import { recalculateAllOptimierungFaelligkeiten } from '@/lib/db'

export const OPTIMIERUNG_REMINDER_WEEKS = [4, 2] as const
export type OptimierungReminderWeeks = (typeof OPTIMIERUNG_REMINDER_WEEKS)[number]

type DueRow = {
  id: string
  titel: string
  faellig_am: string
  push_reminder_4w_sent: number
  push_reminder_2w_sent: number
}

async function listAdminUsersWithOptimierungPush(
  db: D1Database
): Promise<string[]> {
  const res = await db
    .prepare(
      `SELECT u.id AS id
       FROM users u
       WHERE u.role IN ('admin', 'system_admin')
         AND u.push_notifications_enabled = 1
         AND COALESCE(u.push_optimierung_faelligkeit, 1) != 0
         AND EXISTS (
           SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id
         )`
    )
    .all<{ id: string }>()
  return (res.results || []).map((r) => r.id)
}

async function markReminderSent(
  db: D1Database,
  ids: string[],
  weeks: OptimierungReminderWeeks
): Promise<void> {
  if (ids.length === 0) return
  const col = weeks === 4 ? 'push_reminder_4w_sent' : 'push_reminder_2w_sent'
  const placeholders = ids.map(() => '?').join(', ')
  await db
    .prepare(`UPDATE optimierungen SET ${col} = 1 WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run()
}

/**
 * Prüft fällige Optimierungen und sendet Push an Admins mit aktivierter Präferenz.
 * Exakt 28 bzw. 14 Kalendertage vor `faellig_am` (App-Zeitzone).
 * Pro Abstand (4w / 2w) höchstens eine Sammel-Benachrichtigung.
 */
export async function processOptimierungFaelligkeitPush(
  db: D1Database
): Promise<{ checked: number; notified: number; pushes: number }> {
  await recalculateAllOptimierungFaelligkeiten(db)

  const today = todayInAppTimezone()
  const res = await db
    .prepare(
      `SELECT id, titel, faellig_am,
              COALESCE(push_reminder_4w_sent, 0) AS push_reminder_4w_sent,
              COALESCE(push_reminder_2w_sent, 0) AS push_reminder_2w_sent
       FROM optimierungen
       WHERE faellig_am IS NOT NULL
         AND faellig_am != ''
         AND status IN ('geplant', 'in_arbeit')
       ORDER BY titel COLLATE NOCASE ASC`
    )
    .all<DueRow>()

  const rows = res.results || []
  const recipients = await listAdminUsersWithOptimierungPush(db)
  if (recipients.length === 0) {
    return { checked: rows.length, notified: 0, pushes: 0 }
  }

  const buckets = new Map<
    OptimierungReminderWeeks,
    { faelligAm: string; items: Array<{ id: string; titel: string }> }
  >()

  for (const row of rows) {
    const daysUntil = differenceCalendarDays(row.faellig_am, today)
    const weeks: OptimierungReminderWeeks | null =
      daysUntil === 28 ? 4 : daysUntil === 14 ? 2 : null
    if (!weeks) continue

    const alreadySent =
      weeks === 4 ? row.push_reminder_4w_sent !== 0 : row.push_reminder_2w_sent !== 0
    if (alreadySent) continue

    const bucket = buckets.get(weeks)
    if (bucket) {
      bucket.items.push({ id: row.id, titel: row.titel })
    } else {
      buckets.set(weeks, {
        faelligAm: row.faellig_am,
        items: [{ id: row.id, titel: row.titel }],
      })
    }
  }

  let notified = 0
  let pushes = 0

  for (const weeks of OPTIMIERUNG_REMINDER_WEEKS) {
    const bucket = buckets.get(weeks)
    if (!bucket || bucket.items.length === 0) continue

    const payload = buildOptimierungDuePush({
      items: bucket.items,
      faelligAm: bucket.faelligAm,
      weeksBefore: weeks,
    })

    let anySent = false
    for (const userId of recipients) {
      const result = await sendPushToUser(db, userId, payload)
      pushes += result.sent
      if (result.sent > 0) anySent = true
    }

    // Flags setzen, auch ohne erfolgreichen Versand – vermeidet Spam bei erneutem Cron
    await markReminderSent(
      db,
      bucket.items.map((i) => i.id),
      weeks
    )
    if (anySent) notified += 1
  }

  return { checked: rows.length, notified, pushes }
}
