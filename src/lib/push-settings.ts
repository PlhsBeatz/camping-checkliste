import type { PushNotificationType } from '@/lib/push-notifications'

/** Bekannte Push-Kategorien – bei neuen Auslösern hier ergänzen. */
export const PUSH_NOTIFICATION_OPTIONS = [
  {
    key: 'rastplatzNearby' as const,
    type: 'rastplatz_nearby' as const,
    label: 'Rastplatz-Empfehlungen unterwegs',
    description:
      'Hinweis, wenn du auf der Route in der Nähe einer Empfehlung aus der Rastplatz-Sammlung bist.',
    /** Nur Admins / System-Admins sehen und steuern diese Option im Profil */
    adminOnly: false as const,
  },
  {
    key: 'optimierungFaelligkeit' as const,
    type: 'optimierung_due' as const,
    label: 'Optimierungen',
    description:
      'Erinnerung 4 und 2 Wochen vor dem Fälligkeitsdatum geplanter Optimierungen.',
    adminOnly: true as const,
  },
  {
    key: 'wartungFaelligkeit' as const,
    type: 'wartung_due' as const,
    label: 'Wartung & Fälligkeiten',
    description: 'Erinnerung, wenn Wartungs- oder Ablaufdaten fällig oder überfällig sind.',
    adminOnly: false as const,
  },
  {
    key: 'restzahlungFaelligkeit' as const,
    type: 'restzahlung_due' as const,
    label: 'Restzahlungen',
    description: 'Erinnerung 30 Tage vor dem Fälligkeitsdatum offener Restzahlungen.',
    adminOnly: false as const,
  },
] as const

export type PushPreferenceKey = (typeof PUSH_NOTIFICATION_OPTIONS)[number]['key']

export type UserPushSettings = {
  enabled: boolean
  rastplatzNearby: boolean
  optimierungFaelligkeit: boolean
  wartungFaelligkeit: boolean
  restzahlungFaelligkeit: boolean
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
    case 'optimierung_due':
      return settings.optimierungFaelligkeit
    case 'wartung_due':
      return settings.wartungFaelligkeit
    case 'restzahlung_due':
      return settings.restzahlungFaelligkeit
    default:
      return false
  }
}

/** Für clientseitige Rastplatz-Alerts (GPS): Master + Rastplatz-Typ + Geräte-Abo */
export function canReceivePushAlerts(
  settings: UserPushSettings,
  browserSubscribed: boolean
): boolean {
  return settings.enabled && settings.rastplatzNearby && browserSubscribed
}
