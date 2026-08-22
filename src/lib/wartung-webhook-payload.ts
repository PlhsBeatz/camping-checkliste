/**
 * CloudEvents-Payload für Wartungs-Webhooks (Erinnerung / Fälligkeit).
 */
import type { Faelligkeit } from '@/lib/db-wartung'
import { differenceCalendarDays, todayInAppTimezone } from '@/lib/app-timezone'
import { resolveEffectiveDueDate } from '@/lib/faelligkeit-status'

export type WartungWebhookEventKind = 'reminder' | 'due'

export type WartungWebhookPayload = {
  faelligkeit: {
    id: string
    name: string
    kategorie: string
    naechste_faelligkeit: string | null
    ampel_status: string
    warnung_tage_vorher: number
    days_until_due: number | null
    sicherheitsrelevant: boolean
    equipment_id: string | null
    transport_id: string | null
  }
  event_kind: WartungWebhookEventKind
  calendar_timezone: 'Europe/Berlin'
}

export function buildWartungWebhookPayload(
  item: Faelligkeit,
  eventKind: WartungWebhookEventKind,
  today = todayInAppTimezone()
): WartungWebhookPayload {
  const due = resolveEffectiveDueDate(item)
  const daysUntilDue = due != null ? differenceCalendarDays(due, today) : null

  return {
    faelligkeit: {
      id: item.id,
      name: item.name,
      kategorie: item.kategorie,
      naechste_faelligkeit: item.naechste_faelligkeit,
      ampel_status: item.ampel_status ?? 'ok',
      warnung_tage_vorher: item.warnung_tage_vorher,
      days_until_due: daysUntilDue,
      sicherheitsrelevant: item.sicherheitsrelevant,
      equipment_id: item.equipment_id,
      transport_id: item.transport_id,
    },
    event_kind: eventKind,
    calendar_timezone: 'Europe/Berlin',
  }
}
