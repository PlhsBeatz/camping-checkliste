export const ATTENTION_CHANGED_EVENT = 'camping-attention-changed'

export function notifyAttentionChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(ATTENTION_CHANGED_EVENT))
}
