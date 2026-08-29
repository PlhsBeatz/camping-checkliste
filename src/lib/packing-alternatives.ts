/**
 * Bestätigte Entweder-oder-Gruppen und Laufzeit-Hinweise.
 * Eine Gruppe hat mindestens zwei Seiten (option_index): 1 gegen 1 oder 1 gegen mehrere.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type AlternativeItem = {
  gegenstand_id: string
  was: string
  option_index: number
}

export type AlternativeOption = {
  option_index: number
  items: Array<{ gegenstand_id: string; was: string }>
}

export type AlternativeGroup = {
  id: string
  titel: string | null
  genau_eines: boolean
  items: AlternativeItem[]
  options: AlternativeOption[]
}

type GroupRow = { id: string; titel: string | null; genau_eines: number }
type ItemRow = {
  gruppe_id: string
  gegenstand_id: string
  was: string
  option_index?: number | null
}

export function formatOptionLabel(items: Array<{ was: string }>): string {
  const names = items.map((i) => i.was).filter(Boolean)
  if (names.length === 0) return ''
  if (names.length === 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} und ${names[1]}`
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`
}

export function formatXorChoice(options: Array<{ items: Array<{ was: string }> }>): string {
  return options.map((o) => formatOptionLabel(o.items)).filter(Boolean).join(' oder ')
}

export function optionsFromItems(items: AlternativeItem[]): AlternativeOption[] {
  if (items.length === 0) return []
  const distinct = new Set(items.map((i) => i.option_index))
  if (distinct.size <= 1 && items.length >= 2) {
    return items.map((it, i) => ({
      option_index: i,
      items: [{ gegenstand_id: it.gegenstand_id, was: it.was }],
    }))
  }
  const by = new Map<number, AlternativeOption['items']>()
  for (const it of items) {
    const arr = by.get(it.option_index) ?? []
    arr.push({ gegenstand_id: it.gegenstand_id, was: it.was })
    by.set(it.option_index, arr)
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([option_index, optionItems]) => ({ option_index, items: optionItems }))
}

function mapGroup(g: GroupRow, items: AlternativeItem[]): AlternativeGroup {
  return {
    id: g.id,
    titel: g.titel,
    genau_eines: !!g.genau_eines,
    items,
    options: optionsFromItems(items),
  }
}

function mapItemRows(rows: ItemRow[] | undefined): Map<string, AlternativeItem[]> {
  const byGroup = new Map<string, AlternativeItem[]>()
  for (const row of rows || []) {
    const arr = byGroup.get(row.gruppe_id) ?? []
    arr.push({
      gegenstand_id: row.gegenstand_id,
      was: row.was,
      option_index: Number(row.option_index ?? 0),
    })
    byGroup.set(row.gruppe_id, arr)
  }
  return byGroup
}

const ITEMS_SQL = `SELECT i.gruppe_id, i.gegenstand_id, ag.was, i.option_index
           FROM ausruestung_alternativgruppe_items i
           JOIN ausruestungsgegenstaende ag ON ag.id = i.gegenstand_id`
const ITEMS_SQL_LEGACY = `SELECT i.gruppe_id, i.gegenstand_id, ag.was
           FROM ausruestung_alternativgruppe_items i
           JOIN ausruestungsgegenstaende ag ON ag.id = i.gegenstand_id`

async function loadAlternativeItems(
  db: D1Database,
  gruppeId?: string
): Promise<Map<string, AlternativeItem[]>> {
  const where = gruppeId ? ' WHERE i.gruppe_id = ?' : ''
  try {
    const itemRes = gruppeId
      ? await db.prepare(`${ITEMS_SQL}${where}`).bind(gruppeId).all<ItemRow>()
      : await db.prepare(ITEMS_SQL).all<ItemRow>()
    return mapItemRows(itemRes.results)
  } catch {
    const itemRes = gruppeId
      ? await db.prepare(`${ITEMS_SQL_LEGACY}${where}`).bind(gruppeId).all<ItemRow>()
      : await db.prepare(ITEMS_SQL_LEGACY).all<ItemRow>()
    return mapItemRows(itemRes.results)
  }
}

export async function listAlternativeGroups(db: D1Database): Promise<AlternativeGroup[]> {
  try {
    const groups = await db
      .prepare('SELECT id, titel, genau_eines FROM ausruestung_alternativgruppen')
      .all<GroupRow>()
    const byGroup = await loadAlternativeItems(db)
    return (groups.results || []).map((g) => mapGroup(g, byGroup.get(g.id) ?? []))
  } catch (error) {
    console.error('listAlternativeGroups:', error)
    return []
  }
}

export async function getAlternativeGroupById(
  db: D1Database,
  id: string
): Promise<AlternativeGroup | null> {
  const g = await db
    .prepare('SELECT id, titel, genau_eines FROM ausruestung_alternativgruppen WHERE id = ?')
    .bind(id)
    .first<GroupRow>()
  if (!g) return null
  const byGroup = await loadAlternativeItems(db, id)
  return mapGroup(g, byGroup.get(id) ?? [])
}

/** Flat: jeder Gegenstand eine Seite. Nested: innere Arrays sind Seiten (1 gegen mehrere). */
export function normalizeXorOptions(input: string[] | string[][]): string[][] {
  if (input.length === 0) return []
  const first = input[0]
  if (Array.isArray(first)) {
    return (input as string[][])
      .map((ids) => [...new Set(ids.filter(Boolean))])
      .filter((ids) => ids.length > 0)
  }
  const ids = [...new Set((input as string[]).filter(Boolean))]
  return ids.map((id) => [id])
}

export async function createAlternativeGroup(
  db: D1Database,
  input: string[] | string[][],
  titel?: string | null
): Promise<AlternativeGroup | null> {
  const options = normalizeXorOptions(input)
  const allIds = options.flat()
  if (options.length < 2 || allIds.length < 2) return null
  const id = crypto.randomUUID()
  const statements = [
    db
      .prepare(
        `INSERT INTO ausruestung_alternativgruppen (id, titel, genau_eines) VALUES (?, ?, 1)`
      )
      .bind(id, titel ?? null),
  ]
  for (let i = 0; i < options.length; i++) {
    const optionIds = options[i]
    if (!optionIds) continue
    for (const gid of optionIds) {
      statements.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO ausruestung_alternativgruppe_items
             (gruppe_id, gegenstand_id, option_index) VALUES (?, ?, ?)`
          )
          .bind(id, gid, i)
      )
    }
  }
  await db.batch(statements)
  const created = await getAlternativeGroupById(db, id)
  if (created) return created
  const items: AlternativeItem[] = options.flatMap((optionIds, option_index) =>
    (optionIds ?? []).map((gegenstand_id) => ({
      gegenstand_id,
      was: '',
      option_index,
    }))
  )
  return mapGroup({ id, titel: titel ?? null, genau_eines: 1 }, items)
}

export async function deleteAlternativeGroup(db: D1Database, groupId: string): Promise<boolean> {
  if (!groupId) return false
  try {
    await db.prepare('DELETE FROM packliste_xor_ignoriert WHERE gruppe_id = ?').bind(groupId).run()
  } catch {
    /* Tabelle existiert ggf. noch nicht */
  }
  const [, groupRes] = await db.batch([
    db
      .prepare('DELETE FROM ausruestung_alternativgruppe_items WHERE gruppe_id = ?')
      .bind(groupId),
    db.prepare('DELETE FROM ausruestung_alternativgruppen WHERE id = ?').bind(groupId),
  ])
  return (groupRes?.meta?.changes ?? 0) > 0
}

export function groupsForGegenstand(
  groups: AlternativeGroup[],
  gegenstandId: string
): AlternativeGroup[] {
  return groups.filter((g) => g.items.some((i) => i.gegenstand_id === gegenstandId))
}

export type XorConflict = {
  group_id: string
  titel: string | null
  on_list: Array<{ gegenstand_id: string; was: string }>
  /** Seiten, die aktuell auf der Packliste stehen (je eine Checkbox). */
  options: AlternativeOption[]
  choice_label: string
}

export type XorReplacement = {
  group_id: string
  removed_was: string
  suggest: Array<{ gegenstand_id: string; was: string }>
  suggest_label: string
}

function optionsOnList(g: AlternativeGroup, packed: Set<string>): AlternativeOption[] {
  return g.options
    .map((o) => ({
      option_index: o.option_index,
      items: o.items.filter((i) => packed.has(i.gegenstand_id)),
    }))
    .filter((o) => o.items.length > 0)
}

function toXorConflict(g: AlternativeGroup, active: AlternativeOption[]): XorConflict {
  return {
    group_id: g.id,
    titel: g.titel,
    on_list: active.flatMap((o) => o.items),
    options: active,
    choice_label: g.titel?.trim() || formatXorChoice(g.options),
  }
}

/** Gerade ergänzte Seite behalten, wenn die andere schon auf der Liste stand. */
export function suggestedKeepOptionIndex(
  conflict: XorConflict,
  justAddedGegenstandIds: string[]
): number | null {
  const added = new Set(justAddedGegenstandIds)
  if (added.size === 0) return null
  const withNew = conflict.options.filter((o) =>
    o.items.some((i) => added.has(i.gegenstand_id))
  )
  const withOld = conflict.options.filter((o) =>
    o.items.some((i) => !added.has(i.gegenstand_id))
  )
  if (withNew.length === 1 && withOld.length >= 1) {
    return withNew[0]?.option_index ?? null
  }
  return null
}

export function conflictsForPackingList(
  groups: AlternativeGroup[],
  packedGegenstandIds: string[]
): XorConflict[] {
  const set = new Set(packedGegenstandIds)
  const out: XorConflict[] = []
  for (const g of groups) {
    if (!g.genau_eines) continue
    const active = optionsOnList(g, set)
    if (active.length < 2) continue
    out.push(toXorConflict(g, active))
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
    const own = g.options.find((o) => o.items.some((i) => i.gegenstand_id === addingId))
    if (!own) continue
    const others = g.options.filter(
      (o) =>
        o.option_index !== own.option_index && o.items.some((i) => set.has(i.gegenstand_id))
    )
    if (others.length === 0) continue
    return toXorConflict(g, [
      {
        option_index: own.option_index,
        items: own.items.filter((i) => i.gegenstand_id === addingId),
      },
      ...others.map((o) => ({
        option_index: o.option_index,
        items: o.items.filter((i) => set.has(i.gegenstand_id)),
      })),
    ])
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
    if (set.has(removedId)) return null
    const own = g.options.find((o) => o.items.some((i) => i.gegenstand_id === removedId))
    if (!own) continue
    const restSameSide = own.items.filter(
      (i) => i.gegenstand_id !== removedId && set.has(i.gegenstand_id)
    )
    if (restSameSide.length > 0) return null
    const otherActive = g.options.filter(
      (o) =>
        o.option_index !== own.option_index && o.items.some((i) => set.has(i.gegenstand_id))
    )
    if (otherActive.length > 0) return null
    const other = g.options.find((o) => o.option_index !== own.option_index)
    if (!other || other.items.length === 0) return null
    return {
      group_id: g.id,
      removed_was: removedWas,
      suggest: other.items,
      suggest_label: formatOptionLabel(other.items),
    }
  }
  return null
}

export async function listXorIgnoredGroupIds(
  db: D1Database,
  packlisteId: string
): Promise<string[]> {
  if (!packlisteId) return []
  try {
    const res = await db
      .prepare('SELECT gruppe_id FROM packliste_xor_ignoriert WHERE packliste_id = ?')
      .bind(packlisteId)
      .all<{ gruppe_id: string }>()
    return (res.results ?? []).map((r) => r.gruppe_id).filter(Boolean)
  } catch (error) {
    console.error('listXorIgnoredGroupIds:', error)
    return []
  }
}

export async function ignoreXorGroupForPackliste(
  db: D1Database,
  packlisteId: string,
  gruppeId: string
): Promise<boolean> {
  if (!packlisteId || !gruppeId) return false
  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO packliste_xor_ignoriert (packliste_id, gruppe_id)
         VALUES (?, ?)`
      )
      .bind(packlisteId, gruppeId)
      .run()
    return true
  } catch (error) {
    console.error('ignoreXorGroupForPackliste:', error)
    return false
  }
}
