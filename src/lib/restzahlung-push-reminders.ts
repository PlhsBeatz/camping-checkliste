/**
 * Tägliche Push-Erinnerung 30 Kalendertage vor restzahlung_faellig_am.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { differenceCalendarDays, todayInAppTimezone } from '@/lib/app-timezone'
import { buildRestzahlungDuePush } from '@/lib/push-notifications'
import { sendPushToUser } from '@/lib/web-push'

export const RESTZAHLUNG_PUSH_DAYS_BEFORE = 30

type DueRow = {
  id: string
  urlaub_id: string
  restzahlung_faellig_am: string
  campingplatz_name: string
  push_restzahlung_30d_sent: number
}

async function listUsersWithRestzahlungPush(db: D1Database): Promise<string[]> {
  try {
    const res = await db
      .prepare(
        `SELECT u.id AS id
         FROM users u
         WHERE u.push_notifications_enabled = 1
           AND COALESCE(u.push_restzahlung, 1) != 0
           AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)`
      )
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  } catch {
    const res = await db
      .prepare(
        `SELECT u.id AS id
         FROM users u
         WHERE u.push_notifications_enabled = 1
           AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)`
      )
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  }
}

export async function processRestzahlungPush(
  db: D1Database
): Promise<{ checked: number; notified: number; pushes: number }> {
  const today = todayInAppTimezone()
  let rows: DueRow[] = []
  try {
    const res = await db
      .prepare(
        `SELECT uc.id, uc.urlaub_id, uc.restzahlung_faellig_am,
                c.name AS campingplatz_name,
                COALESCE(uc.push_restzahlung_30d_sent, 0) AS push_restzahlung_30d_sent
         FROM urlaub_campingplaetze uc
         JOIN campingplaetze c ON c.id = uc.campingplatz_id
         WHERE uc.restzahlung_faellig_am IS NOT NULL
           AND trim(uc.restzahlung_faellig_am) != ''
           AND (uc.buchungsstatus IS NULL OR uc.buchungsstatus NOT IN ('bezahlt', 'storniert'))
         ORDER BY uc.restzahlung_faellig_am ASC`
      )
      .all<DueRow>()
    rows = res.results || []
  } catch {
    return { checked: 0, notified: 0, pushes: 0 }
  }

  const dueToday = rows.filter((row) => {
    if (row.push_restzahlung_30d_sent !== 0) return false
    return differenceCalendarDays(row.restzahlung_faellig_am, today) === RESTZAHLUNG_PUSH_DAYS_BEFORE
  })

  if (dueToday.length === 0) {
    return { checked: rows.length, notified: 0, pushes: 0 }
  }

  const recipients = await listUsersWithRestzahlungPush(db)
  if (recipients.length === 0) {
    return { checked: rows.length, notified: 0, pushes: 0 }
  }

  let pushes = 0
  let notified = 0

  for (const row of dueToday) {
    const payload = buildRestzahlungDuePush({
      stayId: row.id,
      urlaubId: row.urlaub_id,
      campingplatzName: row.campingplatz_name,
      faelligAm: row.restzahlung_faellig_am,
    })

    let anySent = false
    for (const userId of recipients) {
      const result = await sendPushToUser(db, userId, payload)
      pushes += result.sent
      if (result.sent > 0) anySent = true
    }

    await db
      .prepare(
        `UPDATE urlaub_campingplaetze SET push_restzahlung_30d_sent = 1 WHERE id = ?`
      )
      .bind(row.id)
      .run()

    if (anySent) notified += 1
  }

  return { checked: rows.length, notified, pushes }
}
