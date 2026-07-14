/**
 * Zentrales Schema für Web-Push-Nachrichten.
 * Neue Auslöser/Typen hier ergänzen (Builder + ggf. resolvePushUrl).
 */

export const PUSH_SCHEMA_VERSION = 1 as const

/** Bekannte Push-Typen – bei neuen Auslösern erweitern */
export type PushNotificationType =
  | 'rastplatz_nearby'
  // Zukünftig z. B.:
  // | 'trip_departure_approaching'
  // | 'trip_departure_day'
  // | 'packing_reminder'

export type PushNotificationPayload = {
  schema_version: typeof PUSH_SCHEMA_VERSION
  type: PushNotificationType
  title: string
  body: string
  /** Eindeutiger Tag pro Typ+Kontext (ersetzt ältere Notification) */
  tag: string
  /** Optional; sonst aus type + data abgeleitet */
  url?: string
  /** Typ-spezifische Metadaten (z. B. IDs für Deep-Links) */
  data?: Record<string, string | number | boolean | null>
}

const VALID_TYPES = new Set<string>(['rastplatz_nearby'])

export function isPushNotificationPayload(value: unknown): value is PushNotificationPayload {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    o.schema_version === PUSH_SCHEMA_VERSION &&
    typeof o.type === 'string' &&
    VALID_TYPES.has(o.type) &&
    typeof o.title === 'string' &&
    typeof o.body === 'string' &&
    typeof o.tag === 'string'
  )
}

/** Standard-URL pro Typ, wenn keine url im Payload gesetzt ist */
export function resolvePushUrl(payload: PushNotificationPayload): string {
  if (payload.url?.trim()) return payload.url.trim()

  switch (payload.type) {
    case 'rastplatz_nearby': {
      const id = payload.data?.rastplatz_id
      return typeof id === 'string' && id ? `/rastplaetze` : '/rastplaetze'
    }
    default:
      return '/'
  }
}

/** Anzeige-Optionen für den Service Worker */
export function toServiceWorkerNotification(
  payload: PushNotificationPayload
): { title: string; options: NotificationOptions } {
  return {
    title: payload.title,
    options: {
      body: payload.body,
      icon: '/icons/192?v=5',
      badge: '/icons/192?v=5',
      tag: payload.tag,
      data: {
        schema_version: payload.schema_version,
        type: payload.type,
        url: resolvePushUrl(payload),
        ...(payload.data ?? {}),
      },
    },
  }
}

// --- Builder pro Typ ---

export const RASTPLATZ_NEARBY_ALERT_KM = 30

export function buildRastplatzNearbyPush(params: {
  rastplatzId: string
  name: string
  distanceKm: number
}): PushNotificationPayload {
  const distLabel =
    params.distanceKm >= 10
      ? `${Math.round(params.distanceKm)} km`
      : `${Math.round(params.distanceKm * 10) / 10} km`

  return {
    schema_version: PUSH_SCHEMA_VERSION,
    type: 'rastplatz_nearby',
    title: 'Rastplatz-Empfehlung voraus',
    body: `In ca. ${distLabel}: ${params.name}`,
    tag: `rastplatz_nearby:${params.rastplatzId}`,
    url: '/rastplaetze',
    data: {
      rastplatz_id: params.rastplatzId,
      distance_km: Math.round(params.distanceKm * 10) / 10,
    },
  }
}

/** Client: Push an eigenes Gerät senden (GPS läuft im UI, nicht im SW). */
export async function sendClientPushNotification(
  payload: PushNotificationPayload
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false
  }
  try {
    const res = await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json()) as { success?: boolean }
    return !!json.success
  } catch {
    return false
  }
}
