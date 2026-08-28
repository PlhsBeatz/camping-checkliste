/**
 * Packlisten-Muster aus Historie (ohne KI). Snapshot für Cron + Generator/Hub.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { findCurrentOrNextVacation } from '@/lib/attention-feed'
import { getVacations } from '@/lib/db'
import { seasonFromYmd, type SeasonBucket } from '@/lib/packing-season-tags'
import { upsertSmartSuggestion } from '@/lib/smart-suggestions'

export type PackingPatternSnapshot = {
  computed_at: string
  frequent_adds: Array<{
    gegenstand_id: string
    was: string
    count: number
    seasons: SeasonBucket[]
  }>
  temp_repeats: Array<{ was: string; kategorie_id: string; count: number }>
  copack: Array<{
    a: string
    b: string
    a_was: string
    b_was: string
    support: number
    confidence: number
  }>
  xor_candidates: Array<{
    ids: [string, string]
    names: [string, string]
    kategorie_id: string
    together: number
    either: number
  }>
  never_packed: Array<{ gegenstand_id: string; was: string; trips: number }>
}

type ListRow = {
  gegenstand_id: string
  was: string
  kategorie_id: string
  is_standard: number
  urlaub_id: string
  startdatum: string
  enddatum: string
  gepackt: number
}

type TempRow = {
  was: string
  kategorie_id: string
  urlaub_id: string
  startdatum: string
}

function snapshotId(): string {
  return 'current'
}

export async function getPackingPatternSnapshot(
  db: D1Database
): Promise<PackingPatternSnapshot | null> {
  try {
    const row = await db
      .prepare('SELECT payload_json FROM packing_pattern_snapshot WHERE id = ?')
      .bind(snapshotId())
      .first<{ payload_json: string }>()
    if (!row?.payload_json) return null
    return JSON.parse(row.payload_json) as PackingPatternSnapshot
  } catch {
    return null
  }
}

async function saveSnapshot(db: D1Database, snapshot: PackingPatternSnapshot): Promise<void> {
  await db
    .prepare(
      `INSERT INTO packing_pattern_snapshot (id, payload_json, computed_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, computed_at = excluded.computed_at`
    )
    .bind(snapshotId(), JSON.stringify(snapshot))
    .run()
}

export async function computePackingPatternSnapshot(db: D1Database): Promise<PackingPatternSnapshot> {
  const [listRes, tempRes] = await Promise.all([
    db
      .prepare(
        `SELECT pe.gegenstand_id, ag.was, ag.kategorie_id, ag.is_standard,
                p.urlaub_id, u.startdatum, u.enddatum, pe.gepackt
         FROM packlisten_eintraege pe
         JOIN packlisten p ON pe.packliste_id = p.id
         JOIN urlaube u ON p.urlaub_id = u.id
         JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
         WHERE ag.status != 'Ausgemustert'`
      )
      .all<ListRow>(),
    db
      .prepare(
        `SELECT pet.was, pet.kategorie_id, p.urlaub_id, u.startdatum
         FROM packlisten_eintraege_temporaer pet
         JOIN packlisten p ON pet.packliste_id = p.id
         JOIN urlaube u ON p.urlaub_id = u.id`
      )
      .all<TempRow>(),
  ])

  const lists = listRes.results || []
  const temps = tempRes.results || []

  const byVacation = new Map<string, ListRow[]>()
  for (const row of lists) {
    const arr = byVacation.get(row.urlaub_id) ?? []
    arr.push(row)
    byVacation.set(row.urlaub_id, arr)
  }

  const addCounts = new Map<
    string,
    { was: string; count: number; seasons: Set<SeasonBucket> }
  >()
  for (const row of lists) {
    if (row.is_standard) continue
    const season = seasonFromYmd(row.startdatum)
    const prev = addCounts.get(row.gegenstand_id) ?? {
      was: row.was,
      count: 0,
      seasons: new Set<SeasonBucket>(),
    }
    prev.count += 1
    if (season) prev.seasons.add(season)
    addCounts.set(row.gegenstand_id, prev)
  }
  const frequent_adds = [...addCounts.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([gegenstand_id, v]) => ({
      gegenstand_id,
      was: v.was,
      count: v.count,
      seasons: [...v.seasons],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)

  const tempMap = new Map<string, { was: string; kategorie_id: string; urlaube: Set<string> }>()
  for (const row of temps) {
    const key = `${row.was.trim().toLowerCase()}|${row.kategorie_id}`
    const prev = tempMap.get(key) ?? {
      was: row.was.trim(),
      kategorie_id: row.kategorie_id,
      urlaube: new Set<string>(),
    }
    prev.urlaube.add(row.urlaub_id)
    tempMap.set(key, prev)
  }
  const temp_repeats = [...tempMap.values()]
    .filter((v) => v.urlaube.size >= 2)
    .map((v) => ({ was: v.was, kategorie_id: v.kategorie_id, count: v.urlaube.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)

  const itemNames = new Map<string, string>()
  const itemKat = new Map<string, string>()
  const pairCount = new Map<string, number>()
  const singleCount = new Map<string, number>()
  const tripCount = byVacation.size || 1

  for (const rows of byVacation.values()) {
    const ids = [...new Set(rows.map((r) => r.gegenstand_id))]
    for (const id of ids) {
      singleCount.set(id, (singleCount.get(id) ?? 0) + 1)
      const sample = rows.find((r) => r.gegenstand_id === id)
      if (sample) {
        itemNames.set(id, sample.was)
        itemKat.set(id, sample.kategorie_id)
      }
    }
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const left = ids[i]
        const right = ids[j]
        if (!left || !right) continue
        const a = left < right ? left : right
        const b = left < right ? right : left
        const key = `${a}|${b}`
        pairCount.set(key, (pairCount.get(key) ?? 0) + 1)
      }
    }
  }

  const copack: PackingPatternSnapshot['copack'] = []
  for (const [key, support] of pairCount) {
    if (support < 2) continue
    const parts = key.split('|')
    const a = parts[0]
    const b = parts[1]
    if (!a || !b) continue
    const ca = singleCount.get(a) ?? 0
    const cb = singleCount.get(b) ?? 0
    const confidence = support / Math.min(ca, cb)
    if (confidence < 0.7) continue
    copack.push({
      a,
      b,
      a_was: itemNames.get(a) ?? a,
      b_was: itemNames.get(b) ?? b,
      support,
      confidence,
    })
  }
  copack.sort((x, y) => y.confidence - x.confidence || y.support - x.support)
  const copackTrim = copack.slice(0, 40)

  const xor_candidates: PackingPatternSnapshot['xor_candidates'] = []
  const byKat = new Map<string, string[]>()
  for (const [id, kat] of itemKat) {
    const arr = byKat.get(kat) ?? []
    arr.push(id)
    byKat.set(kat, arr)
  }
  for (const [kategorie_id, ids] of byKat) {
    if (ids.length < 2) continue
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        if (!a || !b) continue
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        const together = pairCount.get(key) ?? 0
        const either = (singleCount.get(a) ?? 0) + (singleCount.get(b) ?? 0) - together
        if (either < 3) continue
        if (together / either > 0.25) continue
        const minShare = Math.min(singleCount.get(a) ?? 0, singleCount.get(b) ?? 0) / tripCount
        if (minShare < 0.15) continue
        xor_candidates.push({
          ids: a < b ? [a, b] : [b, a],
          names: [
            itemNames.get(a < b ? a : b) ?? '',
            itemNames.get(a < b ? b : a) ?? '',
          ],
          kategorie_id,
          together,
          either,
        })
      }
    }
  }
  xor_candidates.sort((a, b) => b.either - a.either)
  const xorTrim = xor_candidates.slice(0, 20)

  const packedTrips = new Map<string, { was: string; trips: number; packed: number }>()
  for (const row of lists) {
    const prev = packedTrips.get(row.gegenstand_id) ?? { was: row.was, trips: 0, packed: 0 }
    prev.trips += 1
    if (row.gepackt) prev.packed += 1
    packedTrips.set(row.gegenstand_id, prev)
  }
  const never_packed = [...packedTrips.entries()]
    .filter(([, v]) => v.trips >= 2 && v.packed === 0)
    .map(([gegenstand_id, v]) => ({ gegenstand_id, was: v.was, trips: v.trips }))
    .slice(0, 15)

  const snapshot: PackingPatternSnapshot = {
    computed_at: new Date().toISOString(),
    frequent_adds,
    temp_repeats,
    copack: copackTrim,
    xor_candidates: xorTrim,
    never_packed,
  }
  await saveSnapshot(db, snapshot)
  return snapshot
}

export async function publishPatternSuggestions(db: D1Database): Promise<number> {
  const snapshot = await getPackingPatternSnapshot(db)
  if (!snapshot) return 0
  const vacations = await getVacations(db)
  const next = findCurrentOrNextVacation(vacations)
  const season = seasonFromYmd(next?.startdatum)
  let n = 0

  const currentIds = new Set<string>()
  if (next) {
    const rows = await db
      .prepare(
        `SELECT pe.gegenstand_id FROM packlisten_eintraege pe
         JOIN packlisten p ON pe.packliste_id = p.id
         WHERE p.urlaub_id = ?`
      )
      .bind(next.id)
      .all<{ gegenstand_id: string }>()
    for (const r of rows.results || []) currentIds.add(r.gegenstand_id)
  }

  for (const add of snapshot.frequent_adds.slice(0, 12)) {
    if (next && currentIds.has(add.gegenstand_id)) continue
    if (season && add.seasons.length > 0 && !add.seasons.includes(season)) continue
    const ok = await upsertSmartSuggestion(db, {
      kind: 'packing_add',
      fingerprint: `add:${add.gegenstand_id}:${season ?? 'any'}`,
      titel: `Oft mitgenommen: ${add.was}`,
      begruendung: `In ${add.count} Packlisten, typisch in der ${add.seasons.join('/') || 'gleichen'} Saison.`,
      payload: { gegenstand_id: add.gegenstand_id, was: add.was, vacation_id: next?.id ?? null },
      kontext_typ: next ? 'vacation' : null,
      kontext_id: next?.id ?? null,
      quelle: 'regel',
    })
    if (ok) n++
  }

  for (const temp of snapshot.temp_repeats.slice(0, 8)) {
    const ok = await upsertSmartSuggestion(db, {
      kind: 'temp_promote',
      fingerprint: `temp:${temp.was.toLowerCase()}|${temp.kategorie_id}`,
      titel: `„${temp.was}“ immer wieder nur temporär`,
      begruendung: `In ${temp.count} Urlauben als temporärer Eintrag – in die Ausrüstung übernehmen?`,
      payload: { was: temp.was, kategorie_id: temp.kategorie_id },
      kontext_typ: next ? 'vacation' : null,
      kontext_id: next?.id ?? null,
      quelle: 'regel',
    })
    if (ok) n++
  }

  if (next) {
    for (const pair of snapshot.copack.slice(0, 15)) {
      const hasA = currentIds.has(pair.a)
      const hasB = currentIds.has(pair.b)
      if (hasA === hasB) continue
      const missing = hasA ? pair.b : pair.a
      const present = hasA ? pair.a_was : pair.b_was
      const missingWas = hasA ? pair.b_was : pair.a_was
      const ok = await upsertSmartSuggestion(db, {
        kind: 'packing_copack',
        fingerprint: `copack:${next.id}:${missing}`,
        titel: `${missingWas} fehlt oft nicht, wenn ${present} dabei ist`,
        begruendung: `In ${Math.round(pair.confidence * 100)} % der Reisen mit dem einen Gegenstand war auch der andere auf der Liste.`,
        payload: {
          gegenstand_id: missing,
          was: missingWas,
          paired_was: present,
          vacation_id: next.id,
        },
        kontext_typ: 'vacation',
        kontext_id: next.id,
        quelle: 'regel',
      })
      if (ok) n++
    }
  }

  for (const xor of snapshot.xor_candidates.slice(0, 8)) {
    const ok = await upsertSmartSuggestion(db, {
      kind: 'xor_candidate',
      fingerprint: `xor:${xor.ids.join('|')}`,
      titel: `Entweder ${xor.names[0]} oder ${xor.names[1]}`,
      begruendung: `Selten zusammen auf einer Packliste, aber oft genau eines von beiden.`,
      payload: { gegenstand_ids: xor.ids, names: xor.names, kategorie_id: xor.kategorie_id },
      quelle: 'regel',
    })
    if (ok) n++
  }

  return n
}

export async function refreshPackingPatternsAndSuggestions(db: D1Database): Promise<{
  snapshot_at: string
  suggestions: number
}> {
  const snapshot = await computePackingPatternSnapshot(db)
  const suggestions = await publishPatternSuggestions(db)
  return { snapshot_at: snapshot.computed_at, suggestions }
}
