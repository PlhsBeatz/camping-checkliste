import type { D1Database } from '@cloudflare/workers-types'

export type IntegrationTokenRow = {
  id: string
  name: string
  token_hash: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export type IntegrationWebhookRow = {
  id: string
  name: string
  url: string
  signing_secret: string
  enabled_events: string
  enabled: number
  created_at: string
}

export type IntegrationVacationStateRow = {
  vacation_id: string
  percent: number
  complete: number
  phase: string
  last_progress_event_percent: number | null
  departure_approaching_sent: number
  departure_day_sent: number
  trip_started_sent: number
  trip_ended_sent: number
  updated_at: string
}

export const ALL_INTEGRATION_EVENT_TYPES = [
  'de.camping-packliste.packing.progress_changed',
  'de.camping-packliste.packing.complete',
  'de.camping-packliste.packing.incomplete',
  'de.camping-packliste.trip.departure_approaching',
  'de.camping-packliste.trip.departure_day',
  'de.camping-packliste.trip.started',
  'de.camping-packliste.trip.ended',
  'de.camping-packliste.integration.test',
] as const

export type IntegrationEventType = (typeof ALL_INTEGRATION_EVENT_TYPES)[number]

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function randomTokenSuffix(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function createIntegrationToken(
  db: D1Database,
  name: string
): Promise<{ id: string; token: string; prefix: string } | null> {
  const id = crypto.randomUUID()
  const suffix = randomTokenSuffix()
  const token = `cpl_${suffix}`
  const prefix = token.slice(0, 12)
  const token_hash = await sha256Hex(token)
  try {
    await db
      .prepare(
        `INSERT INTO integration_tokens (id, name, token_hash, token_prefix) VALUES (?, ?, ?, ?)`
      )
      .bind(id, name.trim(), token_hash, prefix)
      .run()
    return { id, token, prefix }
  } catch (e) {
    console.error('createIntegrationToken failed:', e)
    return null
  }
}

export async function listIntegrationTokens(
  db: D1Database
): Promise<
  Array<{
    id: string
    name: string
    token_prefix: string
    created_at: string
    last_used_at: string | null
    revoked_at: string | null
  }>
> {
  const result = await db
    .prepare(
      `SELECT id, name, token_prefix, created_at, last_used_at, revoked_at
       FROM integration_tokens ORDER BY created_at DESC`
    )
    .all<{
      id: string
      name: string
      token_prefix: string
      created_at: string
      last_used_at: string | null
      revoked_at: string | null
    }>()
  return result.results ?? []
}

export async function revokeIntegrationToken(db: D1Database, id: string): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE integration_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`
    )
    .bind(id)
    .run()
  return (r.meta.changes ?? 0) > 0
}

export async function findIntegrationTokenByBearer(
  db: D1Database,
  bearerToken: string
): Promise<IntegrationTokenRow | null> {
  const hash = await sha256Hex(bearerToken)
  const row = await db
    .prepare(`SELECT * FROM integration_tokens WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1`)
    .bind(hash)
    .first<IntegrationTokenRow>()
  if (!row) return null
  await db
    .prepare(`UPDATE integration_tokens SET last_used_at = datetime('now') WHERE id = ?`)
    .bind(row.id)
    .run()
  return row
}

export function parseEnabledEvents(raw: string): IntegrationEventType[] {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...ALL_INTEGRATION_EVENT_TYPES]
    return parsed.filter((e): e is IntegrationEventType =>
      (ALL_INTEGRATION_EVENT_TYPES as readonly string[]).includes(String(e))
    )
  } catch {
    return [...ALL_INTEGRATION_EVENT_TYPES]
  }
}

export async function createIntegrationWebhook(
  db: D1Database,
  input: { name: string; url: string; signing_secret: string; enabled_events?: IntegrationEventType[] }
): Promise<{ id: string; signing_secret: string } | null> {
  const id = crypto.randomUUID()
  const events = JSON.stringify(input.enabled_events ?? [...ALL_INTEGRATION_EVENT_TYPES])
  try {
    await db
      .prepare(
        `INSERT INTO integration_webhooks (id, name, url, signing_secret, enabled_events, enabled)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .bind(id, input.name.trim(), input.url.trim(), input.signing_secret, events)
      .run()
    return { id, signing_secret: input.signing_secret }
  } catch (e) {
    console.error('createIntegrationWebhook failed:', e)
    return null
  }
}

export type IntegrationWebhookPublic = {
  id: string
  name: string
  url: string
  enabled_events: IntegrationEventType[]
  enabled: boolean
  created_at: string
}

export async function listIntegrationWebhooks(db: D1Database): Promise<IntegrationWebhookPublic[]> {
  const result = await db
    .prepare(
      `SELECT id, name, url, enabled_events, enabled, created_at FROM integration_webhooks ORDER BY created_at DESC`
    )
    .all<Omit<IntegrationWebhookPublic, 'enabled_events' | 'enabled'> & { enabled_events: string; enabled: number }>()
  return (result.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    enabled_events: parseEnabledEvents(r.enabled_events),
    enabled: !!r.enabled,
    created_at: r.created_at,
  }))
}

export async function getEnabledIntegrationWebhooks(
  db: D1Database
): Promise<Array<IntegrationWebhookRow & { parsed_events: IntegrationEventType[] }>> {
  const result = await db
    .prepare(`SELECT * FROM integration_webhooks WHERE enabled = 1`)
    .all<IntegrationWebhookRow>()
  return (result.results ?? []).map((row) => ({
    ...row,
    parsed_events: parseEnabledEvents(row.enabled_events),
  }))
}

export async function deleteIntegrationWebhook(db: D1Database, id: string): Promise<boolean> {
  const r = await db.prepare(`DELETE FROM integration_webhooks WHERE id = ?`).bind(id).run()
  return (r.meta.changes ?? 0) > 0
}

export async function updateIntegrationWebhook(
  db: D1Database,
  id: string,
  updates: { name?: string; url?: string; enabled?: boolean; enabled_events?: IntegrationEventType[] }
): Promise<boolean> {
  const sets: string[] = []
  const binds: unknown[] = []
  if (updates.name !== undefined) {
    sets.push('name = ?')
    binds.push(updates.name.trim())
  }
  if (updates.url !== undefined) {
    sets.push('url = ?')
    binds.push(updates.url.trim())
  }
  if (updates.enabled !== undefined) {
    sets.push('enabled = ?')
    binds.push(updates.enabled ? 1 : 0)
  }
  if (updates.enabled_events !== undefined) {
    sets.push('enabled_events = ?')
    binds.push(JSON.stringify(updates.enabled_events))
  }
  if (sets.length === 0) return false
  binds.push(id)
  const r = await db
    .prepare(`UPDATE integration_webhooks SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run()
  return (r.meta.changes ?? 0) > 0
}

export async function getIntegrationVacationState(
  db: D1Database,
  vacationId: string
): Promise<IntegrationVacationStateRow | null> {
  return (
    (await db
      .prepare(`SELECT * FROM integration_vacation_state WHERE vacation_id = ?`)
      .bind(vacationId)
      .first<IntegrationVacationStateRow>()) ?? null
  )
}

export async function upsertIntegrationVacationState(
  db: D1Database,
  state: Omit<IntegrationVacationStateRow, 'updated_at'>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO integration_vacation_state (
        vacation_id, percent, complete, phase, last_progress_event_percent,
        departure_approaching_sent, departure_day_sent, trip_started_sent, trip_ended_sent, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(vacation_id) DO UPDATE SET
        percent = excluded.percent,
        complete = excluded.complete,
        phase = excluded.phase,
        last_progress_event_percent = excluded.last_progress_event_percent,
        departure_approaching_sent = excluded.departure_approaching_sent,
        departure_day_sent = excluded.departure_day_sent,
        trip_started_sent = excluded.trip_started_sent,
        trip_ended_sent = excluded.trip_ended_sent,
        updated_at = datetime('now')`
    )
    .bind(
      state.vacation_id,
      state.percent,
      state.complete,
      state.phase,
      state.last_progress_event_percent,
      state.departure_approaching_sent,
      state.departure_day_sent,
      state.trip_started_sent,
      state.trip_ended_sent
    )
    .run()
}

export async function logWebhookDelivery(
  db: D1Database,
  entry: {
    id: string
    webhook_id: string
    event_type: string
    event_id: string
    vacation_id: string | null
    http_status: number | null
    success: boolean
    error_message: string | null
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO integration_webhook_deliveries
       (id, webhook_id, event_type, event_id, vacation_id, http_status, success, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.id,
      entry.webhook_id,
      entry.event_type,
      entry.event_id,
      entry.vacation_id,
      entry.http_status,
      entry.success ? 1 : 0,
      entry.error_message
    )
    .run()
}

export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
