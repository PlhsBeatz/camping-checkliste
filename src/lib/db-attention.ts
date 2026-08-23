/**
 * Persistenz für Attention-Snooze (Haushalts-Feed).
 */
import type { D1Database } from '@cloudflare/workers-types'

export type AttentionSnoozeRow = {
  item_key: string
  snoozed_until: string
  created_at: string
}

export async function getAttentionSnoozes(
  db: D1Database
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const res = await db
      .prepare('SELECT item_key, snoozed_until FROM attention_snooze')
      .all<{ item_key: string; snoozed_until: string }>()
    for (const row of res.results || []) {
      if (row.item_key && row.snoozed_until) {
        map.set(row.item_key, row.snoozed_until)
      }
    }
  } catch (error) {
    console.error('Error getAttentionSnoozes:', error)
  }
  return map
}

export async function upsertAttentionSnooze(
  db: D1Database,
  itemKey: string,
  snoozedUntil: string
): Promise<boolean> {
  try {
    await db
      .prepare(
        `INSERT INTO attention_snooze (item_key, snoozed_until, created_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(item_key) DO UPDATE SET snoozed_until = excluded.snoozed_until`
      )
      .bind(itemKey, snoozedUntil)
      .run()
    return true
  } catch (error) {
    console.error('Error upsertAttentionSnooze:', error)
    return false
  }
}

export async function deleteAttentionSnooze(
  db: D1Database,
  itemKey: string
): Promise<boolean> {
  try {
    await db
      .prepare('DELETE FROM attention_snooze WHERE item_key = ?')
      .bind(itemKey)
      .run()
    return true
  } catch (error) {
    console.error('Error deleteAttentionSnooze:', error)
    return false
  }
}
