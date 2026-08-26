export const ATTENTION_CHANGED_EVENT = 'camping-attention-changed'

export function notifyAttentionChanged(badgeCount?: number) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(ATTENTION_CHANGED_EVENT, {
      detail: badgeCount != null ? { badgeCount } : undefined,
    })
  )
}
