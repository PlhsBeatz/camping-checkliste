import type { D1Database } from '@cloudflare/workers-types'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { buildPushHTTPRequest } from '@pushforge/builder'
import {
  deletePushSubscriptionByEndpoint,
  getAllPushSubscriptions,
  getPushSubscriptionsForUser,
} from '@/lib/db'
import type { CloudflareEnv } from '@/lib/db'
import type { PushNotificationPayload } from '@/lib/push-notifications'

export type PushSendError = {
  endpoint: string
  status?: number
  detail: string
  removed?: boolean
}

export type PushSendResult = {
  sent: number
  failed: number
  errors?: PushSendError[]
}

type PushEnv = {
  publicKey: string | null
  privateJwk: Record<string, unknown> | null
  privateKeyParseFailed: boolean
  subject: string
}

function base64UrlEncode(binary: string): string {
  return Buffer.from(binary, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function derivePublicKeyFromJwk(jwk: Record<string, unknown>): string | null {
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return null
  const base64UrlDecodeString = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/')
  const base64Decode = (b64: string) => {
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4 || 4)) % 4), '=')
    return Buffer.from(padded, 'base64').toString('binary')
  }
  return base64UrlEncode(
    `\x04${base64Decode(base64UrlDecodeString(jwk.x))}${base64Decode(base64UrlDecodeString(jwk.y))}`
  )
}

function parsePrivateJwk(raw: string | undefined): {
  jwk: Record<string, unknown> | null
  parseFailed: boolean
} {
  if (!raw?.trim()) return { jwk: null, parseFailed: false }
  try {
    return { jwk: JSON.parse(raw) as Record<string, unknown>, parseFailed: false }
  } catch {
    return { jwk: null, parseFailed: true }
  }
}

async function resolvePushEnv(): Promise<PushEnv> {
  let publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || null
  let privateRaw = process.env.VAPID_PRIVATE_KEY
  let subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com'

  try {
    const { env } = await getCloudflareContext({ async: true })
    const cf = env as CloudflareEnv
    publicKey = publicKey || cf.VAPID_PUBLIC_KEY?.trim() || null
    privateRaw = privateRaw || cf.VAPID_PRIVATE_KEY
    subject = subject || cf.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com'
  } catch {
    /* ohne Worker-Kontext */
  }

  const { jwk, parseFailed } = parsePrivateJwk(privateRaw)
  return {
    publicKey,
    privateJwk: jwk,
    privateKeyParseFailed: parseFailed,
    subject,
  }
}

export async function getVapidConfigStatus(): Promise<{
  publicKey: string | null
  enabled: boolean
  privateKeyConfigured: boolean
  privateKeyParseFailed: boolean
  keyPairMatch: boolean
}> {
  const env = await resolvePushEnv()
  const derived = env.privateJwk ? derivePublicKeyFromJwk(env.privateJwk) : null
  return {
    publicKey: env.publicKey,
    enabled: !!env.publicKey && !!env.privateJwk,
    privateKeyConfigured: !!process.env.VAPID_PRIVATE_KEY?.trim(),
    privateKeyParseFailed: env.privateKeyParseFailed,
    keyPairMatch: !!env.publicKey && !!derived && env.publicKey === derived,
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null
}

function headersForFetch(headers: Headers | Record<string, string>): Record<string, string> {
  if (headers instanceof Headers) {
    const out: Record<string, string> = {}
    headers.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  return headers
}

function bodyForFetch(body: ArrayBuffer): Uint8Array {
  return new Uint8Array(body)
}

function shortEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint)
    return `${url.host}${url.pathname.slice(0, 24)}…`
  } catch {
    return endpoint.slice(0, 40)
  }
}

export async function sendPushToSubscriptions(
  subscriptions: Array<{ endpoint: string; subscription_json: string }>,
  message: PushNotificationPayload,
  db?: D1Database
): Promise<PushSendResult> {
  const pushEnv = await resolvePushEnv()
  const errors: PushSendError[] = []

  if (!pushEnv.privateJwk) {
    const detail = pushEnv.privateKeyParseFailed
      ? 'VAPID_PRIVATE_KEY ist kein gültiges JSON – in .dev.vars in einfache Anführungszeichen setzen.'
      : 'VAPID_PRIVATE_KEY fehlt – pnpm dev neu starten.'
    for (const row of subscriptions) {
      errors.push({ endpoint: shortEndpoint(row.endpoint), detail })
    }
    return { sent: 0, failed: subscriptions.length, errors }
  }

  let sent = 0
  let failed = 0

  for (const row of subscriptions) {
    try {
      const sub = JSON.parse(row.subscription_json) as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }
      const { endpoint, headers, body } = await buildPushHTTPRequest({
        privateJWK: pushEnv.privateJwk,
        subscription: sub,
        message: {
          payload: message,
          adminContact: pushEnv.subject,
          options: { topic: message.tag },
        },
      })
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: headersForFetch(headers),
        body: bodyForFetch(body),
      })
      if (res.ok) {
        sent += 1
        continue
      }

      const responseText = (await res.text()).slice(0, 300)
      failed += 1

      if (res.status === 404 || res.status === 410) {
        if (db) await deletePushSubscriptionByEndpoint(db, row.endpoint)
        errors.push({
          endpoint: shortEndpoint(row.endpoint),
          status: res.status,
          detail:
            res.status === 410
              ? 'Push-Abo abgelaufen – Push im Profil neu aktivieren.'
              : 'Push-Endpunkt ungültig – neu abonnieren.',
          removed: true,
        })
      } else if (res.status === 401 || res.status === 403) {
        errors.push({
          endpoint: shortEndpoint(row.endpoint),
          status: res.status,
          detail: `VAPID/Auth abgelehnt (${res.status}). Public/Private-Key-Paar und VAPID_SUBJECT prüfen.`,
        })
      } else {
        errors.push({
          endpoint: shortEndpoint(row.endpoint),
          status: res.status,
          detail: responseText || `Push-Dienst antwortete mit HTTP ${res.status}`,
        })
      }
    } catch (error: unknown) {
      failed += 1
      errors.push({
        endpoint: shortEndpoint(row.endpoint),
        detail: error instanceof Error ? error.message : 'Unbekannter Fehler beim Senden',
      })
    }
  }

  return { sent, failed, errors: errors.length > 0 ? errors : undefined }
}

export async function sendPushToUser(
  db: D1Database,
  userId: string,
  message: PushNotificationPayload
): Promise<PushSendResult> {
  const subs = await getPushSubscriptionsForUser(db, userId)
  return sendPushToSubscriptions(subs, message, db)
}

export async function sendPushToAll(
  db: D1Database,
  message: PushNotificationPayload
): Promise<PushSendResult> {
  const subs = await getAllPushSubscriptions(db)
  return sendPushToSubscriptions(subs, message, db)
}
