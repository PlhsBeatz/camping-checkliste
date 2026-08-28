export const SMART_SUGGESTIONS_CHANGED_EVENT = 'camping-smart-suggestions-changed'

export function notifySmartSuggestionsChanged(count?: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(SMART_SUGGESTIONS_CHANGED_EVENT, {
      detail: count != null ? { count } : undefined,
    })
  )
}
