/** Merkt Listen-URL + Scroll, damit Zurück zur gefilterten Campingplatz-Liste geht. */

const SCROLL_KEY = 'campingplaetze-list-scroll'
const HREF_KEY = 'campingplaetze-list-href'

export function rememberCampingplaetzeListNavigation(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    sessionStorage.setItem(HREF_KEY, `${window.location.pathname}${window.location.search}`)
  } catch {
    /* ignore */
  }
}

/** Gespeicherte Scrollposition lesen (ohne zu löschen – für Strict-Mode-sicheren Restore). */
export function peekCampingplaetzeListScroll(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY)
    if (raw == null) return null
    const y = Number(raw)
    return Number.isFinite(y) && y > 0 ? y : null
  } catch {
    return null
  }
}

export function clearCampingplaetzeListScroll(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(SCROLL_KEY)
  } catch {
    /* ignore */
  }
}

/** Zuletzt besuchte Listen-URL inkl. Filter-Query (für „Zur Liste“). */
export function peekCampingplaetzeListHref(): string {
  if (typeof window === 'undefined') return '/campingplaetze'
  try {
    return sessionStorage.getItem(HREF_KEY) || '/campingplaetze'
  } catch {
    return '/campingplaetze'
  }
}
