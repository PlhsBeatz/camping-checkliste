/** Packlisten-UI pro Urlaub (sessionStorage – überlebt Reconnect/Remount). */
export interface PacklistUiSettings {
  hidePackedItems?: boolean
  listDisplayMode?: 'alles' | 'packliste'
  selectedPackProfile?: string | null
}

const KEY_PREFIX = 'packlistUi:'

export function readPacklistUiSettings(vacationId: string): PacklistUiSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${vacationId}`)
    if (!raw) return null
    return JSON.parse(raw) as PacklistUiSettings
  } catch {
    return null
  }
}

export function writePacklistUiSettings(
  vacationId: string,
  patch: PacklistUiSettings
): void {
  if (typeof window === 'undefined') return
  try {
    const prev = readPacklistUiSettings(vacationId) ?? {}
    sessionStorage.setItem(
      `${KEY_PREFIX}${vacationId}`,
      JSON.stringify({ ...prev, ...patch })
    )
  } catch {
    /* quota / private mode */
  }
}
