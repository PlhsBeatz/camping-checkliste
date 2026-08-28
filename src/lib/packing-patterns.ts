/**
 * Packlisten-Muster aus Historie. XOR braucht zusätzlich einen inhaltlichen
 * Zusammenhang; optionales KI-Veto verwirft Zufallspaare.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { findCurrentOrNextVacation } from '@/lib/attention-feed'
import { getCampingplaetzeForVacation, getVacations } from '@/lib/db'
import { formatSeasonBuckets, seasonFromYmd, type SeasonBucket } from '@/lib/packing-season-tags'
import {
  fitReasonText,
  itemFitsTargetTrip,
  loadItemTripOccurrences,
  loadTripPackProfiles,
  profileFromVacation,
} from '@/lib/packing-trip-match'
import { setSmartSuggestionStatus, upsertSmartSuggestion } from '@/lib/smart-suggestions'
import { listAlternativeGroups } from '@/lib/packing-alternatives'
import { confirmXorCandidatesWithAi } from '@/lib/xor-ai-confirm'
import { xorItemsRelated, xorOptionsRelated } from '@/lib/xor-relatedness'

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
    options: Array<{ ids: string[]; names: string[] }>
    ids: string[]
    names: string[]
    kategorie_id: string
    together: number
    either: number
    a_count: number
    b_count: number
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

  const itemStandard = new Map<string, boolean>()
  for (const rows of byVacation.values()) {
    for (const row of rows) {
      if (!itemStandard.has(row.gegenstand_id)) {
        itemStandard.set(row.gegenstand_id, !!row.is_standard)
      }
    }
  }

  const xorPairs: Array<{
    ids: [string, string]
    names: [string, string]
    kategorie_id: string
    together: number
    either: number
    a_count: number
    b_count: number
  }> = []
  const byKat = new Map<string, string[]>()
  for (const [id, kat] of itemKat) {
    if (itemStandard.get(id)) continue
    const share = (singleCount.get(id) ?? 0) / tripCount
    // Staple-Gegenstände (fast immer dabei) sind keine Alternativen
    if (share > 0.7) continue
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
        const ca = singleCount.get(a) ?? 0
        const cb = singleCount.get(b) ?? 0
        // Mindestens drei Reisen je Gegenstand, sonst ist es Zufall (z. B. neu angelegt)
        if (ca < 3 || cb < 3) continue
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        const together = pairCount.get(key) ?? 0
        const aOnly = ca - together
        const bOnly = cb - together
        const either = ca + cb - together
        if (aOnly < 2 || bOnly < 2) continue
        if (either < 6) continue
        if (together / either > 0.12) continue
        const freqRatio = Math.max(ca, cb) / Math.min(ca, cb)
        if (freqRatio > 2.5) continue
        const aWas = itemNames.get(a) ?? ''
        const bWas = itemNames.get(b) ?? ''
        if (!xorItemsRelated({ was: aWas }, { was: bWas })) continue
        xorPairs.push({
          ids: a < b ? [a, b] : [b, a],
          names: [
            itemNames.get(a < b ? a : b) ?? '',
            itemNames.get(a < b ? b : a) ?? '',
          ],
          kategorie_id,
          together,
          either,
          a_count: a < b ? ca : cb,
          b_count: a < b ? cb : ca,
        })
      }
    }
  }
  xorPairs.sort((x, y) => {
    const xAlt = Math.min(x.a_count - x.together, x.b_count - x.together)
    const yAlt = Math.min(y.a_count - y.together, y.b_count - y.together)
    return yAlt - xAlt || y.either - x.either
  })

  const copackConf = (a: string, b: string): number => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`
    const together = pairCount.get(key) ?? 0
    const min = Math.min(singleCount.get(a) ?? 0, singleCount.get(b) ?? 0)
    return min === 0 ? 0 : together / min
  }
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

  const adj = new Map<string, Set<string>>()
  const pairByKey = new Map<string, (typeof xorPairs)[number]>()
  for (const p of xorPairs) {
    const a = p.ids[0]
    const b = p.ids[1]
    if (!a || !b) continue
    pairByKey.set(pairKey(a, b), p)
    const sa = adj.get(a) ?? new Set<string>()
    sa.add(b)
    adj.set(a, sa)
    const sb = adj.get(b) ?? new Set<string>()
    sb.add(a)
    adj.set(b, sb)
  }

  const usedPairKeys = new Set<string>()
  const xorMerged: PackingPatternSnapshot['xor_candidates'] = []

  const soloCandidates = [...adj.entries()].sort((x, y) => y[1].size - x[1].size)
  for (const [solo, partnerSet] of soloCandidates) {
    const partners = [...partnerSet]
    if (partners.length < 2) continue
    let best: string[] = []
    for (const seed of partners) {
      const cluster = [seed]
      for (const other of partners) {
        if (other === seed) continue
        if (cluster.every((m) => copackConf(m, other) >= 0.75)) cluster.push(other)
      }
      if (cluster.length > best.length) best = cluster
    }
    if (best.length < 2) continue
    const soloName = itemNames.get(solo) ?? solo
    const bundleRelated = xorOptionsRelated(
      [{ was: soloName }],
      best.map((id) => ({ was: itemNames.get(id) ?? id }))
    )
    if (!bundleRelated) continue
    const keys = best.map((p) => pairKey(solo, p))
    if (keys.some((k) => usedPairKeys.has(k))) continue
    for (const k of keys) usedPairKeys.add(k)
    const sample = pairByKey.get(keys[0] ?? '')
    const bundleNames = best.map((id) => itemNames.get(id) ?? id)
    xorMerged.push({
      options: [
        { ids: [solo], names: [soloName] },
        { ids: best, names: bundleNames },
      ],
      ids: [solo, ...best].sort(),
      names: [soloName, bundleNames.join(' und ')],
      kategorie_id: sample?.kategorie_id ?? itemKat.get(solo) ?? '',
      together: sample?.together ?? 0,
      either: sample?.either ?? 0,
      a_count: singleCount.get(solo) ?? 0,
      b_count: Math.max(...best.map((id) => singleCount.get(id) ?? 0)),
    })
  }

  for (const p of xorPairs) {
    const k = pairKey(p.ids[0], p.ids[1])
    if (usedPairKeys.has(k)) continue
    xorMerged.push({
      options: [
        { ids: [p.ids[0]], names: [p.names[0]] },
        { ids: [p.ids[1]], names: [p.names[1]] },
      ],
      ids: [...p.ids].sort(),
      names: p.names,
      kategorie_id: p.kategorie_id,
      together: p.together,
      either: p.either,
      a_count: p.a_count,
      b_count: p.b_count,
    })
  }

  xorMerged.sort((a, b) => {
    const aBundle = Math.max(...a.options.map((o) => o.ids.length))
    const bBundle = Math.max(...b.options.map((o) => o.ids.length))
    return bBundle - aBundle || b.either - a.either
  })
  const xorTrim: PackingPatternSnapshot['xor_candidates'] = []
  const xorPerItem = new Map<string, number>()
  for (const cand of xorMerged) {
    if (cand.ids.some((id) => (xorPerItem.get(id) ?? 0) >= 1)) continue
    xorTrim.push(cand)
    for (const id of cand.ids) xorPerItem.set(id, (xorPerItem.get(id) ?? 0) + 1)
    if (xorTrim.length >= 6) break
  }

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

export async function publishPatternSuggestions(
  db: D1Database,
  opts?: { apiKey?: string | null }
): Promise<number> {
  const snapshot = await getPackingPatternSnapshot(db)
  if (!snapshot) return 0
  const vacations = await getVacations(db)
  const next = findCurrentOrNextVacation(vacations)
  const season = seasonFromYmd(next?.startdatum)
  const existingAltIds = new Set<string>()
  for (const g of await listAlternativeGroups(db)) {
    for (const item of g.items) existingAltIds.add(item.gegenstand_id)
  }
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

  const trips = await loadTripPackProfiles(db)
  const itemOcc = await loadItemTripOccurrences(db, trips)
  const allTrips = [...trips.values()]
  let targetProfile = next ? trips.get(next.id) : undefined
  if (next && !targetProfile) {
    const places = await getCampingplaetzeForVacation(db, next.id)
    targetProfile = profileFromVacation(next, places.map((p) => p.land))
  }

  const keepAddFingerprints = new Set<string>()
  for (const add of snapshot.frequent_adds.slice(0, 24)) {
    if (next && currentIds.has(add.gegenstand_id)) continue
    if (season && add.seasons.length > 0 && !add.seasons.includes(season)) continue
    let extraReason: string | null = null
    if (targetProfile) {
      const fit = itemFitsTargetTrip(
        targetProfile,
        itemOcc.get(add.gegenstand_id) ?? [],
        allTrips
      )
      if (!fit.ok) continue
      extraReason = fitReasonText(fit.reason, targetProfile.days)
    }
    const seasonLabel = formatSeasonBuckets(add.seasons)
    const begruendung = extraReason
      ? extraReason
      : seasonLabel
        ? `Stand in ${add.count} Packlisten, typisch in der Saison ${seasonLabel}.`
        : `Stand in ${add.count} Packlisten.`
    const fingerprint = `add:${add.gegenstand_id}:${next?.id ?? 'any'}`
    keepAddFingerprints.add(fingerprint)
    const ok = await upsertSmartSuggestion(db, {
      kind: 'packing_add',
      fingerprint,
      titel: `Oft mitgenommen: ${add.was}`,
      begruendung,
      payload: {
        gegenstand_id: add.gegenstand_id,
        was: add.was,
        vacation_id: next?.id ?? null,
        vacation_titel: next?.titel ?? null,
        seasons: add.seasons,
        count: add.count,
      },
      kontext_typ: next ? 'vacation' : null,
      kontext_id: next?.id ?? null,
      quelle: 'regel',
    })
    if (ok) n++
    if (n >= 12) break
  }

  if (next) {
    try {
      const staleAdds = await db
        .prepare(
          `SELECT id, fingerprint FROM smart_vorschlaege
           WHERE kind = 'packing_add' AND status IN ('pending', 'snoozed') AND kontext_id = ?`
        )
        .bind(next.id)
        .all<{ id: string; fingerprint: string }>()
      for (const row of staleAdds.results || []) {
        if (!keepAddFingerprints.has(row.fingerprint)) {
          await setSmartSuggestionStatus(db, row.id, 'dismissed')
        }
      }
    } catch (error) {
      console.error('stale packing_add cleanup:', error)
    }
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
          vacation_titel: next.titel,
        },
        kontext_typ: 'vacation',
        kontext_id: next.id,
        quelle: 'regel',
      })
      if (ok) n++
    }
  }

  const xorFingerprints = new Set<string>()
  const xorForPublish = await confirmXorCandidatesWithAi(
    db,
    opts?.apiKey,
    snapshot.xor_candidates.slice(0, 6)
  )
  for (const xor of xorForPublish.slice(0, 4)) {
    if (xor.ids.some((id) => existingAltIds.has(id))) continue
    const fp = `xor:${xor.ids.join('|')}`
    xorFingerprints.add(fp)
    const left = xor.options[0]
    const right = xor.options[1]
    const leftLabel = left?.names.join(' und ') ?? xor.names[0] ?? ''
    const rightLabel = right?.names.join(' und ') ?? xor.names[1] ?? ''
    const isBundle = (left?.ids.length ?? 1) > 1 || (right?.ids.length ?? 1) > 1
    const ok = await upsertSmartSuggestion(db, {
      kind: 'xor_candidate',
      fingerprint: fp,
      titel: `Entweder ${leftLabel} oder ${rightLabel}`,
      begruendung: isBundle
        ? `Gleiche Funktion: entweder „${leftLabel}“ oder „${rightLabel}“ zusammen – in den Packlisten fast nie gemischt.`
        : `Gleiche Funktion, in ${xor.either} Packlisten kam mindestens eines vor, zusammen nur ${xor.together}×.`,
      payload: {
        gegenstand_ids: xor.ids,
        names: [leftLabel, rightLabel],
        options: xor.options.map((o) => ({
          gegenstand_ids: o.ids,
          names: o.names,
        })),
        kategorie_id: xor.kategorie_id,
        together: xor.together,
        either: xor.either,
        a_count: xor.a_count,
        b_count: xor.b_count,
      },
      quelle: 'regel',
    })
    if (ok) n++
  }

  try {
    const staleXor = await db
      .prepare(
        `SELECT id, fingerprint FROM smart_vorschlaege
         WHERE kind = 'xor_candidate' AND status IN ('pending', 'snoozed')`
      )
      .all<{ id: string; fingerprint: string }>()
    for (const row of staleXor.results || []) {
      if (!xorFingerprints.has(row.fingerprint)) {
        await setSmartSuggestionStatus(db, row.id, 'dismissed')
      }
    }
  } catch (error) {
    console.error('stale xor cleanup:', error)
  }

  return n
}

export async function refreshPackingPatternsAndSuggestions(
  db: D1Database,
  opts?: { apiKey?: string | null }
): Promise<{
  snapshot_at: string
  suggestions: number
}> {
  const snapshot = await computePackingPatternSnapshot(db)
  const suggestions = await publishPatternSuggestions(db, opts)
  return { snapshot_at: snapshot.computed_at, suggestions }
}
