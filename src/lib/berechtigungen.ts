/** Granulare Berechtigungs-Schlüssel (mitreisende_berechtigungen.berechtigung). */

export const BERECHTIGUNG_CAN_EDIT_PAUSCHAL = 'can_edit_pauschal_entries'
export const BERECHTIGUNG_GEPACKT_ELTERN = 'gepackt_erfordert_elternkontrolle'
export const BERECHTIGUNG_READ_WARTUNG = 'can_read_wartung'
export const BERECHTIGUNG_WRITE_WARTUNG = 'can_write_wartung'
export const BERECHTIGUNG_READ_OPTIMIERUNG = 'can_read_optimierung'
export const BERECHTIGUNG_WRITE_OPTIMIERUNG = 'can_write_optimierung'

export const KIND_BERECHTIGUNG_OPTIONS = [
  { key: BERECHTIGUNG_CAN_EDIT_PAUSCHAL, label: 'Pauschale Einträge bearbeiten' },
  { key: BERECHTIGUNG_GEPACKT_ELTERN, label: 'Gepackt erfordert Elternkontrolle' },
] as const

export const ERWACHSEN_BERECHTIGUNG_OPTIONS = [
  { key: BERECHTIGUNG_CAN_EDIT_PAUSCHAL, label: 'Pauschale Einträge bearbeiten' },
  { key: BERECHTIGUNG_READ_WARTUNG, label: 'Wartung lesen' },
  { key: BERECHTIGUNG_WRITE_WARTUNG, label: 'Wartung bearbeiten' },
  { key: BERECHTIGUNG_READ_OPTIMIERUNG, label: 'Optimierungen lesen' },
  { key: BERECHTIGUNG_WRITE_OPTIMIERUNG, label: 'Optimierungen bearbeiten' },
] as const

export const ERWACHSEN_BERECHTIGUNG_KEYS = ERWACHSEN_BERECHTIGUNG_OPTIONS.map((o) => o.key)

export const WARTUNG_OPTIMIERUNG_BERECHTIGUNG_KEYS = [
  BERECHTIGUNG_READ_WARTUNG,
  BERECHTIGUNG_WRITE_WARTUNG,
  BERECHTIGUNG_READ_OPTIMIERUNG,
  BERECHTIGUNG_WRITE_OPTIMIERUNG,
] as const

const WRITE_TO_READ: Record<string, string> = {
  [BERECHTIGUNG_WRITE_WARTUNG]: BERECHTIGUNG_READ_WARTUNG,
  [BERECHTIGUNG_WRITE_OPTIMIERUNG]: BERECHTIGUNG_READ_OPTIMIERUNG,
}

const READ_TO_WRITE: Record<string, string> = {
  [BERECHTIGUNG_READ_WARTUNG]: BERECHTIGUNG_WRITE_WARTUNG,
  [BERECHTIGUNG_READ_OPTIMIERUNG]: BERECHTIGUNG_WRITE_OPTIMIERUNG,
}

export function isErwachsenBerechtigung(key: string): boolean {
  return (ERWACHSEN_BERECHTIGUNG_KEYS as readonly string[]).includes(key)
}

export function isWartungOptimierungBerechtigung(key: string): boolean {
  return (WARTUNG_OPTIMIERUNG_BERECHTIGUNG_KEYS as readonly string[]).includes(key)
}

/** Schreiben setzt automatisch Lesen; Lesen abwählen entfernt auch Schreiben. */
export function toggleBerechtigung(prev: string[], key: string, checked: boolean): string[] {
  if (checked) {
    let next = prev.includes(key) ? prev : [...prev, key]
    const readKey = WRITE_TO_READ[key]
    if (readKey && !next.includes(readKey)) next = [...next, readKey]
    return next
  }
  let next = prev.filter((k) => k !== key)
  const writeKey = READ_TO_WRITE[key]
  if (writeKey) next = next.filter((k) => k !== writeKey)
  return next
}

export function filterErwachsenBerechtigungen(berechtigungen: string[]): string[] {
  return berechtigungen.filter(isErwachsenBerechtigung)
}
