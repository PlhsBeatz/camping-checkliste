import type { D1Database } from '@cloudflare/workers-types'

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function getAiCallCache(
  db: D1Database,
  cacheKey: string,
  ttlMs = DEFAULT_TTL_MS
): Promise<Record<string, unknown> | null> {
  try {
    const row = await db
      .prepare('SELECT payload_json, created_at FROM ai_call_cache WHERE cache_key = ?')
      .bind(cacheKey)
      .first<{ payload_json: string; created_at: string }>()
    if (!row?.payload_json) return null
    const created = Date.parse(row.created_at.replace(' ', 'T') + 'Z')
    if (Number.isFinite(created) && Date.now() - created > ttlMs) return null
    return JSON.parse(row.payload_json) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function setAiCallCache(
  db: D1Database,
  cacheKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO ai_call_cache (cache_key, payload_json, created_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(cache_key) DO UPDATE SET
           payload_json = excluded.payload_json,
           created_at = excluded.created_at`
      )
      .bind(cacheKey, JSON.stringify(payload))
      .run()
  } catch (error) {
    console.error('setAiCallCache:', error)
  }
}

export function hashCacheKey(parts: string[]): string {
  const s = parts.join('\u001f')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `h${(h >>> 0).toString(16)}`
}
