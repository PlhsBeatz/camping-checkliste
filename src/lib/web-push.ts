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
import { describeVapidSetupError, type VapidDiagnostics } from '@/lib/push-vapid-errors'

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
  explicitPublicKey: string | null
  privateJwk: Record<string, unknown> | null
  privateKeyParseFailed: boolean
  subject: string
  diagnostics: VapidDiagnostics
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

function readEnvString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  return undefined
}

function readPrivateKeyRaw(value: unknown): string | undefined {
  const asString = readEnvString(value)
  if (asString) return asString
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return undefined
    }
  }
  return undefined
}

function parsePrivateJwk(raw: unknown): {
  jwk: Record<string, unknown> | null
  parseFailed: boolean
} {
  if (raw == null) return { jwk: null, parseFailed: false }
  if (typeof raw === 'object') {
    return { jwk: raw as Record<string, unknown>, parseFailed: false }
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return { jwk: null, parseFailed: false }
  }
  try {
    return { jwk: JSON.parse(raw) as Record<string, unknown>, parseFailed: false }
  } catch {
    return { jwk: null, parseFailed: true }
  }
}

async function resolvePushEnv(): Promise<PushEnv> {
  const diagnostics: VapidDiagnostics = {
    cloudflareContextAvailable: false,
    publicKeyFromProcessEnv: false,
    publicKeyFromCloudflareEnv: false,
    privateKeyFromProcessEnv: false,
    privateKeyFromCloudflareEnv: false,
    subjectFromProcessEnv: false,
    subjectFromCloudflareEnv: false,
  }

  let publicKey = readEnvString(process.env.VAPID_PUBLIC_KEY) ?? null
  let privateRaw: unknown = process.env.VAPID_PRIVATE_KEY
  let subject = readEnvString(process.env.VAPID_SUBJECT) ?? 'mailto:admin@example.com'

  diagnostics.publicKeyFromProcessEnv = !!publicKey
  diagnostics.privateKeyFromProcessEnv = !!readPrivateKeyRaw(privateRaw)
  diagnostics.subjectFromProcessEnv = !!readEnvString(process.env.VAPID_SUBJECT)

  try {
    const { env } = await getCloudflareContext({ async: true })
    diagnostics.cloudflareContextAvailable = true
    const cf = env as CloudflareEnv

    const cfPublic = readEnvString(cf.VAPID_PUBLIC_KEY)
    if (cfPublic) {
      publicKey = publicKey ?? cfPublic
      diagnostics.publicKeyFromCloudflareEnv = true
    }

    const cfPrivate = readPrivateKeyRaw(cf.VAPID_PRIVATE_KEY)
    if (cfPrivate) {
      privateRaw = privateRaw ?? cfPrivate
      diagnostics.privateKeyFromCloudflareEnv = true
    } else if (cf.VAPID_PRIVATE_KEY && typeof cf.VAPID_PRIVATE_KEY === 'object') {
      privateRaw = privateRaw ?? cf.VAPID_PRIVATE_KEY
      diagnostics.privateKeyFromCloudflareEnv = true
    }

    const cfSubject = readEnvString(cf.VAPID_SUBJECT)
    if (cfSubject) {
      subject = cfSubject
      diagnostics.subjectFromCloudflareEnv = true
    }
  } catch {
    /* ohne Worker-Kontext */
  }

  const privateString = readPrivateKeyRaw(privateRaw)
  const { jwk, parseFailed } = parsePrivateJwk(privateString ?? privateRaw)
  const explicitPublicKey = publicKey

  if (!publicKey && jwk && !parseFailed) {
    publicKey = derivePublicKeyFromJwk(jwk)
  }

  return {
    publicKey,
    explicitPublicKey,
    privateJwk: jwk,
    privateKeyParseFailed: parseFailed,
    subject,
    diagnostics,
  }
}

export async function getVapidConfigStatus(): Promise<{
  publicKey: string | null
  enabled: boolean
  privateKeyConfigured: boolean
  privateKeyParseFailed: boolean
  keyPairMatch: boolean
  diagnostics: VapidDiagnostics
  setupHint: string | null
}> {
  const env = await resolvePushEnv()
  const derived = env.privateJwk ? derivePublicKeyFromJwk(env.privateJwk) : null
  const status = {
    publicKey: env.publicKey,
    enabled: !!env.publicKey && !!env.privateJwk,
    privateKeyConfigured: !!env.privateJwk,
    privateKeyParseFailed: env.privateKeyParseFailed,
    keyPairMatch:
      !!env.privateJwk &&
      !!derived &&
      (!env.explicitPublicKey || env.explicitPublicKey === derived),
    diagnostics: env.diagnostics,
  }
  return {
    ...status,
    setupHint: status.enabled
      ? null
      : describeVapidSetupError({ ...status, diagnostics: env.diagnostics }),
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
    const detail = describeVapidSetupError({
      publicKey: pushEnv.publicKey,
      privateKeyConfigured: false,
      privateKeyParseFailed: pushEnv.privateKeyParseFailed,
      enabled: false,
    })
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
