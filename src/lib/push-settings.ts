import type { PushNotificationType } from '@/lib/push-notifications'

/** Bekannte Push-Kategorien – bei neuen Auslösern hier ergänzen. */
export const PUSH_NOTIFICATION_OPTIONS = [
  {
    key: 'rastplatzNearby' as const,
    type: 'rastplatz_nearby' as const,
    label: 'Rastplatz-Empfehlungen unterwegs',
    description:
      'Hinweis, wenn du auf der Route in der Nähe einer Empfehlung aus der Rastplatz-Sammlung bist.',
  },
] as const

export type PushPreferenceKey = (typeof PUSH_NOTIFICATION_OPTIONS)[number]['key']

export type UserPushSettings = {
  enabled: boolean
  rastplatzNearby: boolean
}

export type UserPushSettingsResponse = UserPushSettings & {
  browserSubscribed: boolean
  pushSupported: boolean
}

export function isPushTypeEnabled(
  type: PushNotificationType,
  settings: UserPushSettings
): boolean {
  if (!settings.enabled) return false
  switch (type) {
    case 'rastplatz_nearby':
      return settings.rastplatzNearby
    default:
      return false
  }
}

export function canReceivePushAlerts(
  settings: UserPushSettings,
  browserSubscribed: boolean
): boolean {
  return settings.enabled && settings.rastplatzNearby && browserSubscribed
}
