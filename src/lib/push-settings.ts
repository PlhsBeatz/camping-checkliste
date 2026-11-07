import type { PushNotificationType } from '@/lib/push-notifications'

export type FeedbackNotifyMode = 'done' | 'all'

export function isFeedbackNotifyMode(v: unknown): v is FeedbackNotifyMode {
  return v === 'done' || v === 'all'
}

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
  {
    key: 'verbrauchEndstand' as const,
    type: 'verbrauch_endstand' as const,
    label: 'Verbrauchs-Endstände',
    description:
      'Erinnerung nach der Heimkehr, wenn Startstände (z. B. Petroleum/Gas) noch ohne Endstand sind.',
    adminOnly: false as const,
  },
  {
    key: 'feedbackMeldungen' as const,
    type: 'feedback_status' as const,
    label: 'Eigene Feedback-Meldungen',
    description:
      'Benachrichtigung zum Bearbeitungsstand deiner eingereichten Fehler und Ideen.',
    adminOnly: false as const,
  },
] as const

/** Formulierungen für den Benachrichtigungs-Modus eigener Feedback-Meldungen */
export const FEEDBACK_NOTIFY_MODE_OPTIONS = [
  {
    value: 'done' as const,
    label: 'Nur bei Fertigstellung',
    description: 'Einmal, sobald deine Meldung erledigt ist.',
  },
  {
    value: 'all' as const,
    label: 'Bei jeder Statusänderung',
    description: 'Bei jedem Fortschritt, z. B. In Arbeit, In Test oder Erledigt.',
  },
] as const

export const FEEDBACK_PUSH_SETTINGS_HREF = '/einstellungen/benachrichtigungen#push-feedbackMeldungen'

export type PushPreferenceKey = (typeof PUSH_NOTIFICATION_OPTIONS)[number]['key']

export type UserPushSettings = {
  enabled: boolean
  rastplatzNearby: boolean
  optimierungFaelligkeit: boolean
  wartungFaelligkeit: boolean
  restzahlungFaelligkeit: boolean
  verbrauchEndstand: boolean
  /** Default aus – eigene Feedback-Meldungen */
  feedbackMeldungen: boolean
  /** Default: nur Fertigstellung */
  feedbackNotifyMode: FeedbackNotifyMode
}

/** Kurzer Status-Text für Hinweisleisten (Feedback-Seite). */
export function formatFeedbackNotifySummary(
  settings: Pick<UserPushSettings, 'feedbackMeldungen' | 'feedbackNotifyMode'>
): string {
  if (!settings.feedbackMeldungen) return 'Benachrichtigungen aus'
  const mode = settings.feedbackNotifyMode === 'all' ? 'all' : 'done'
  const opt = FEEDBACK_NOTIFY_MODE_OPTIONS.find((o) => o.value === mode)
  return opt?.label ?? 'Nur bei Fertigstellung'
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
    case 'verbrauch_endstand':
      return settings.verbrauchEndstand
    case 'feedback_status':
      return settings.feedbackMeldungen
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

/** Client: Endstand-Erinnerung bei Heimkehr */
export function canReceiveVerbrauchEndstandPush(
  settings: UserPushSettings,
  browserSubscribed: boolean
): boolean {
  return settings.enabled && settings.verbrauchEndstand && browserSubscribed
}
