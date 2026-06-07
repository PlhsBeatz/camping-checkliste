import type { D1Database } from '@cloudflare/workers-types'
import {
  getEnabledIntegrationWebhooks,
  hmacSha256Hex,
  logWebhookDelivery,
  type IntegrationEventType,
} from '@/lib/integration-db'
import type { TripStatusPayload } from '@/lib/trip-readiness'

export type CloudEventPayload = {
  specversion: '1.0'
  type: IntegrationEventType
  /** Alias für Home Assistant: trigger.json['event_type'] (Key type ist in Templates unzuverlässig). */
  event_type: IntegrationEventType
  source: string
  id: string
  time: string
  datacontenttype: 'application/json'
  data: TripStatusPayload
}

export function buildCloudEvent(
  eventType: IntegrationEventType,
  vacationId: string | null,
  data: TripStatusPayload
): CloudEventPayload {
  return {
    specversion: '1.0',
    type: eventType,
    event_type: eventType,
    source: vacationId ? `/vacations/${vacationId}` : '/integrations',
    id: crypto.randomUUID(),
    time: new Date().toISOString(),
    datacontenttype: 'application/json',
    data,
  }
}

export async function deliverWebhookEvent(
  db: D1Database,
  webhook: {
    id: string
    url: string
    signing_secret: string
    parsed_events: IntegrationEventType[]
  },
  event: CloudEventPayload
): Promise<void> {
  if (!webhook.parsed_events.includes(event.type)) return

  const body = JSON.stringify(event)
  let httpStatus: number | null = null
  let success = false
  let errorMessage: string | null = null

  try {
    const signature = await hmacSha256Hex(webhook.signing_secret, body)
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        // application/json: Home Assistant füllt trigger.json nur bei diesem Content-Type zuverlässig
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
      },
      body,
    })
    httpStatus = res.status
    success = res.ok
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      errorMessage = text.slice(0, 500) || `HTTP ${res.status}`
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  await logWebhookDelivery(db, {
    id: crypto.randomUUID(),
    webhook_id: webhook.id,
    event_type: event.type,
    event_id: event.id,
    vacation_id: event.data.vacation?.id ?? null,
    http_status: httpStatus,
    success,
    error_message: errorMessage,
  })
}

export async function deliverEventToAllWebhooks(
  db: D1Database,
  event: CloudEventPayload
): Promise<void> {
  const webhooks = await getEnabledIntegrationWebhooks(db)
  await Promise.allSettled(webhooks.map((wh) => deliverWebhookEvent(db, wh, event)))
}

export async function deliverTestWebhook(
  db: D1Database,
  webhookId: string,
  data: TripStatusPayload
): Promise<{ success: boolean; http_status: number | null; error: string | null }> {
  const webhooks = await getEnabledIntegrationWebhooks(db)
  const webhook = webhooks.find((w) => w.id === webhookId)
  if (!webhook) {
    return { success: false, http_status: null, error: 'Webhook nicht gefunden oder deaktiviert' }
  }

  const event = buildCloudEvent('de.camping-packliste.integration.test', data.vacation.id, data)
  await deliverWebhookEvent(db, webhook, event)

  const delivery = await db
    .prepare(
      `SELECT http_status, success, error_message FROM integration_webhook_deliveries
       WHERE webhook_id = ? AND event_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .bind(webhookId, event.id)
    .first<{ http_status: number | null; success: number; error_message: string | null }>()

  return {
    success: !!delivery?.success,
    http_status: delivery?.http_status ?? null,
    error: delivery?.error_message ?? null,
  }
}
