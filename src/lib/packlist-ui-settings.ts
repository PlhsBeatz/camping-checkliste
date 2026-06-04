/** Packlisten-UI pro Urlaub (sessionStorage – überlebt Reconnect/Remount). */
export interface PacklistUiSettings {
  hidePackedItems?: boolean
  listDisplayMode?: 'alles' | 'packliste'
  selectedPackProfile?: string | null
  activeMainCategory?: string
}

export interface PacklistUiState {
  hidePackedItems: boolean
  listDisplayMode: 'alles' | 'packliste'
  selectedPackProfile: string | null
  activeMainCategory: string
}

const KEY_PREFIX = 'packlistUi:'

/** Kurzzeit-Cache: schützt vor sessionStorage-Überschreiben in React Strict Mode / Remount. */
const memoryByVacation = new Map<string, PacklistUiSettings>()

const DEFAULT_UI: PacklistUiState = {
  hidePackedItems: true,
  listDisplayMode: 'packliste',
  selectedPackProfile: null,
  activeMainCategory: '',
}

export function resolveVacationIdForUi(): string | null {
  if (typeof window === 'undefined') return null
  return (
    new URLSearchParams(window.location.search).get('vacation') ||
    sessionStorage.getItem('packlistVacationId')
  )
}

export function readPacklistUiSettings(vacationId: string): PacklistUiSettings | null {
  const mem = memoryByVacation.get(vacationId)
  if (mem) return mem
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${vacationId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PacklistUiSettings
    memoryByVacation.set(vacationId, parsed)
    return parsed
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
    const next = { ...prev, ...patch }
    memoryByVacation.set(vacationId, next)
    sessionStorage.setItem(`${KEY_PREFIX}${vacationId}`, JSON.stringify(next))
  } catch {
    /* quota / private mode */
  }
}

/** Synchron beim ersten Render – vor jedem Effect, der Defaults in den Storage schreiben könnte. */
export function getInitialPacklistUiState(
  vacationId: string | null
): PacklistUiState {
  if (!vacationId) return DEFAULT_UI
  const saved = readPacklistUiSettings(vacationId)
  return {
    hidePackedItems: saved?.hidePackedItems ?? DEFAULT_UI.hidePackedItems,
    listDisplayMode: saved?.listDisplayMode ?? DEFAULT_UI.listDisplayMode,
    selectedPackProfile:
      saved?.selectedPackProfile !== undefined
        ? saved.selectedPackProfile
        : DEFAULT_UI.selectedPackProfile,
    activeMainCategory: saved?.activeMainCategory ?? DEFAULT_UI.activeMainCategory,
  }
}
