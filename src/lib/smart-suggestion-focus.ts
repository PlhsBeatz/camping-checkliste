export const SUGGESTION_FOCUS_PARAM = 'fokus'
export const PLATZPLAN_SECTION_ID = 'platzplan'
export const SUGGESTION_FOCUS_FLASH_MS = 1800

export function suggestionDomId(id: string): string {
  return `vorschlag-${id}`
}

export function suggestionInboxHref(id: string): string {
  return `/tools/vorschlaege?${SUGGESTION_FOCUS_PARAM}=${encodeURIComponent(id)}`
}

export function readSuggestionFocusId(
  search: Pick<URLSearchParams, 'get'> | { get(name: string): string | null }
): string | null {
  const value = search.get(SUGGESTION_FOCUS_PARAM)?.trim()
  return value || null
}
