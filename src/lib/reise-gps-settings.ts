/** GPS-/Reise-Modus: wann Standortverfolgung aktiv ist */
export type ReiseGpsMode = 'auto' | 'on' | 'off'

export const REISE_GPS_MODE_OPTIONS: Array<{
  value: ReiseGpsMode
  label: string
  description: string
}> = [
  {
    value: 'auto',
    label: 'Automatisch',
    description: 'GPS nur an Reisetagen (Abfahrt und Tage zwischen Campingplätzen).',
  },
  {
    value: 'on',
    label: 'Ein',
    description: 'Standortverfolgung dauerhaft aktiv (auch außerhalb von Urlauben).',
  },
  {
    value: 'off',
    label: 'Aus',
    description: 'GPS dauerhaft deaktiviert – keine Rastplatz-Hinweise unterwegs.',
  },
]

export const DEFAULT_REISE_GPS_MODE: ReiseGpsMode = 'auto'

export function parseReiseGpsMode(value: unknown): ReiseGpsMode {
  if (value === 'auto' || value === 'on' || value === 'off') return value
  return DEFAULT_REISE_GPS_MODE
}

/** Ob GPS gerade laufen soll (Profil-Einstellung + optional Reisekontext). */
export function isReiseGpsActive(mode: ReiseGpsMode, isTravelContext: boolean): boolean {
  switch (mode) {
    case 'on':
      return true
    case 'auto':
      return isTravelContext
    case 'off':
      return false
  }
}

/** Reise-Features (Rast-Hinweise, Panel) nur bei aktivem GPS und Reisekontext. */
export function isReiseFeatureActive(mode: ReiseGpsMode, isTravelContext: boolean): boolean {
  return isTravelContext && isReiseGpsActive(mode, isTravelContext)
}
