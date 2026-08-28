import type { ApiResponse } from '@/lib/api-types'

export async function postSmartSuggestionAction(
  id: string,
  action: 'accept' | 'dismiss' | 'snooze',
  extra?: { url?: string; days?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch('/api/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      action,
      days: action === 'snooze' ? extra?.days ?? 7 : undefined,
      url: extra?.url,
    }),
  })
  const json = (await res.json()) as ApiResponse<unknown>
  if (!res.ok || !json.success) {
    return { ok: false, error: json.error ?? 'Aktion fehlgeschlagen' }
  }
  return { ok: true }
}
