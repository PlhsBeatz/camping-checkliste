/**
 * Tägliche Push-Erinnerungen und Webhooks für Wartungs-Fälligkeiten.
 * Erinnerung: X Tage vor Fälligkeit (warnung_tage_vorher), einmal pro Zyklus.
 * Fälligkeit: am/ nach Fälligkeitstag, Webhook einmal pro Zyklus.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  listFaelligkeitenDueForPush,
  listFaelligkeitenDueForWebhook,
  listUsersWithWartungPush,
  markFaelligkeitDueSent,
  markFaelligkeitPushSent,
} from '@/lib/db-wartung'
import { buildWartungDuePush } from '@/lib/push-notifications'
import { sendPushToUser } from '@/lib/web-push'
import { todayInAppTimezone } from '@/lib/app-timezone'
import { buildWartungWebhookPayload } from '@/lib/wartung-webhook-payload'
import { buildWartungCloudEvent, deliverEventToAllWebhooks } from '@/lib/webhooks'

export async function processWartungFaelligkeitPush(
  db: D1Database
): Promise<{
  reminder_checked: number
  reminder_notified: number
  reminder_pushes: number
  reminder_webhooks: number
  due_checked: number
  due_webhooks: number
}> {
  const today = todayInAppTimezone()

  const reminderItems = await listFaelligkeitenDueForPush(db)
  let reminderPushes = 0
  let reminderNotified = 0

  if (reminderItems.length > 0) {
    for (const item of reminderItems) {
      const payload = buildWartungWebhookPayload(item, 'reminder', today)
      await deliverEventToAllWebhooks(
        db,
        buildWartungCloudEvent('de.camping-packliste.wartung.reminder', payload)
      )
    }

    const recipients = await listUsersWithWartungPush(db)
    if (recipients.length > 0) {
      const pushPayload = buildWartungDuePush({
        items: reminderItems.map((i) => ({
          id: i.id,
          name: i.name,
          ampel_status: i.ampel_status ?? 'bald_faellig',
          naechste_faelligkeit: i.naechste_faelligkeit,
        })),
        today,
      })

      for (const userId of recipients) {
        const result = await sendPushToUser(db, userId, pushPayload)
        reminderPushes += result.sent
        if (result.sent > 0) reminderNotified = 1
      }
    }

    await markFaelligkeitPushSent(
      db,
      reminderItems.map((i) => i.id)
    )
  }

  const dueItems = await listFaelligkeitenDueForWebhook(db)
  if (dueItems.length > 0) {
    for (const item of dueItems) {
      const payload = buildWartungWebhookPayload(item, 'due', today)
      await deliverEventToAllWebhooks(
        db,
        buildWartungCloudEvent('de.camping-packliste.wartung.due', payload)
      )
    }
    await markFaelligkeitDueSent(
      db,
      dueItems.map((i) => i.id)
    )
  }

  return {
    reminder_checked: reminderItems.length,
    reminder_notified: reminderNotified,
    reminder_pushes: reminderPushes,
    reminder_webhooks: reminderItems.length,
    due_checked: dueItems.length,
    due_webhooks: dueItems.length,
  }
}
