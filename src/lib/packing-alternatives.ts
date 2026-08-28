/**
 * Bestätigte Entweder-oder-Gruppen und Laufzeit-Hinweise.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type AlternativeGroup = {
  id: string
  titel: string | null
  genau_eines: boolean
  items: Array<{ gegenstand_id: string; was: string }>
}

type GroupRow = { id: string; titel: string | null; genau_eines: number }
type ItemRow = { gruppe_id: string; gegenstand_id: string; was: string }

export async function listAlternativeGroups(db: D1Database): Promise<AlternativeGroup[]> {
  try {
    const groups = await db
      .prepare('SELECT id, titel, genau_eines FROM ausruestung_alternativgruppen')
      .all<GroupRow>()
    const items = await db
      .prepare(
        `SELECT i.gruppe_id, i.gegenstand_id, ag.was
         FROM ausruestung_alternativgruppe_items i
         JOIN ausruestungsgegenstaende ag ON ag.id = i.gegenstand_id`
      )
      .all<ItemRow>()
    const byGroup = new Map<string, AlternativeGroup['items']>()
    for (const row of items.results || []) {
      const arr = byGroup.get(row.gruppe_id) ?? []
      arr.push({ gegenstand_id: row.gegenstand_id, was: row.was })
      byGroup.set(row.gruppe_id, arr)
    }
    return (groups.results || []).map((g) => ({
      id: g.id,
      titel: g.titel,
      genau_eines: !!g.genau_eines,
      items: byGroup.get(g.id) ?? [],
    }))
  } catch (error) {
    console.error('listAlternativeGroups:', error)
    return []
  }
}

export async function createAlternativeGroup(
  db: D1Database,
  gegenstandIds: string[],
  titel?: string | null
): Promise<AlternativeGroup | null> {
  const ids = [...new Set(gegenstandIds.filter(Boolean))]
  if (ids.length < 2) return null
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO ausruestung_alternativgruppen (id, titel, genau_eines) VALUES (?, ?, 1)`
    )
    .bind(id, titel ?? null)
    .run()
  for (const gid of ids) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO ausruestung_alternativgruppe_items (gruppe_id, gegenstand_id) VALUES (?, ?)`
      )
      .bind(id, gid)
      .run()
  }
  const all = await listAlternativeGroups(db)
  return all.find((g) => g.id === id) ?? null
}

export type XorConflict = {
  group_id: string
  titel: string | null
  on_list: Array<{ gegenstand_id: string; was: string }>
}

export type XorReplacement = {
  group_id: string
  removed_was: string
  suggest: Array<{ gegenstand_id: string; was: string }>
}

export function conflictsForPackingList(
  groups: AlternativeGroup[],
  packedGegenstandIds: string[]
): XorConflict[] {
  const set = new Set(packedGegenstandIds)
  const out: XorConflict[] = []
  for (const g of groups) {
    if (!g.genau_eines) continue
    const on_list = g.items.filter((i) => set.has(i.gegenstand_id))
    if (on_list.length >= 2) {
      out.push({ group_id: g.id, titel: g.titel, on_list })
    }
  }
  return out
}

export function conflictIfAdding(
  groups: AlternativeGroup[],
  packedGegenstandIds: string[],
  addingId: string
): XorConflict | null {
  const set = new Set(packedGegenstandIds)
  for (const g of groups) {
    if (!g.items.some((i) => i.gegenstand_id === addingId)) continue
    const others = g.items.filter((i) => i.gegenstand_id !== addingId && set.has(i.gegenstand_id))
    if (others.length > 0) {
      return { group_id: g.id, titel: g.titel, on_list: others }
    }
  }
  return null
}

export function replacementAfterRemoving(
  groups: AlternativeGroup[],
  packedGegenstandIds: string[],
  removedId: string,
  removedWas: string
): XorReplacement | null {
  const set = new Set(packedGegenstandIds)
  for (const g of groups) {
    if (!g.items.some((i) => i.gegenstand_id === removedId)) continue
    const remainingOnList = g.items.filter(
      (i) => i.gegenstand_id !== removedId && set.has(i.gegenstand_id)
    )
    if (remainingOnList.length > 0) return null
    const suggest = g.items.filter((i) => i.gegenstand_id !== removedId)
    if (suggest.length === 0) return null
    return { group_id: g.id, removed_was: removedWas, suggest }
  }
  return null
}
