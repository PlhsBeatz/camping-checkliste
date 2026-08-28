/**
 * Kategorie-Vorschlag: Regeln bei ähnlichem Namen, Auto-KI bei wirklich neuen Namen.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { chatJson } from '@/lib/ai/openrouter-client'
import { getAiCallCache, hashCacheKey, setAiCallCache } from '@/lib/ai/ai-call-cache'

import type { CategorySuggestMatch } from '@/lib/category-suggest-types'

export type { CategorySuggestMatch }

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): string[] {
  return normalizeName(s).split(' ').filter((t) => t.length >= 2)
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = tokens(b)
  if (ta.size === 0 || tb.length === 0) return 0
  let hit = 0
  for (const t of tb) if (ta.has(t)) hit++
  return hit / Math.max(ta.size, tb.length)
}

type EquipmentNameRow = { id: string; was: string; kategorie_id: string }
type TempNameRow = { was: string; kategorie_id: string; n: number }

export async function loadCategorySuggestCorpus(db: D1Database): Promise<{
  equipment: EquipmentNameRow[]
  tempByName: TempNameRow[]
  categories: Array<{ id: string; titel: string; hauptkategorie_titel: string }>
}> {
  const [eqRes, tempRes, catRes] = await Promise.all([
    db
      .prepare(
        `SELECT id, was, kategorie_id FROM ausruestungsgegenstaende
         WHERE status != 'Ausgemustert'`
      )
      .all<EquipmentNameRow>(),
    db
      .prepare(
        `SELECT was, kategorie_id, COUNT(*) as n
         FROM packlisten_eintraege_temporaer
         GROUP BY was, kategorie_id`
      )
      .all<TempNameRow>(),
    db
      .prepare(
        `SELECT k.id, k.titel, hk.titel as hauptkategorie_titel
         FROM kategorien k
         JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
         ORDER BY hk.reihenfolge, k.reihenfolge`
      )
      .all<{ id: string; titel: string; hauptkategorie_titel: string }>(),
  ])
  return {
    equipment: eqRes.results || [],
    tempByName: tempRes.results || [],
    categories: catRes.results || [],
  }
}

function ruleSuggest(
  name: string,
  corpus: Awaited<ReturnType<typeof loadCategorySuggestCorpus>>
): CategorySuggestMatch | null {
  const needle = normalizeName(name)
  if (needle.length < 2) return null

  let bestEq: { row: EquipmentNameRow; score: number } | null = null
  for (const row of corpus.equipment) {
    const n = normalizeName(row.was)
    if (n === needle) {
      return {
        kategorie_id: row.kategorie_id,
        begruendung: `Entspricht vorhandener Ausrüstung „${row.was}“.`,
        quelle: 'regel',
        duplicate: { id: row.id, was: row.was, kategorie_id: row.kategorie_id },
      }
    }
    const score = tokenOverlap(row.was, name)
    if (score >= 0.55 && (!bestEq || score > bestEq.score)) {
      bestEq = { row, score }
    }
  }
  if (bestEq && bestEq.score >= 0.7) {
    return {
      kategorie_id: bestEq.row.kategorie_id,
      begruendung: `Ähnlich zu „${bestEq.row.was}“.`,
      quelle: 'regel',
      duplicate: bestEq.score >= 0.85
        ? { id: bestEq.row.id, was: bestEq.row.was, kategorie_id: bestEq.row.kategorie_id }
        : null,
    }
  }

  let bestTemp: TempNameRow | null = null
  for (const row of corpus.tempByName) {
    if (normalizeName(row.was) === needle) {
      if (!bestTemp || row.n > bestTemp.n) bestTemp = row
    }
  }
  if (bestTemp) {
    return {
      kategorie_id: bestTemp.kategorie_id,
      begruendung: `So wurde „${bestTemp.was}“ zuvor in der Packliste einsortiert.`,
      quelle: 'regel',
      duplicate: null,
    }
  }

  return null
}

const CATEGORY_SYSTEM = `Du ordnest einen Camping-/Wohnwagen-Gegenstand einer vorhandenen Kategorie zu.
Antworte nur mit JSON: {"kategorie_id":"<id oder null>","begruendung":"<kurzer Satz auf Deutsch>"}.
Wähle ausschließlich eine id aus der Liste. Keine neuen Kategorien erfinden. Wenn unsicher: kategorie_id null.`

async function aiSuggest(
  apiKey: string,
  name: string,
  categories: Array<{ id: string; titel: string; hauptkategorie_titel: string }>,
  db: D1Database
): Promise<CategorySuggestMatch | null> {
  const catKey = categories.map((c) => c.id).join(',')
  const cacheKey = hashCacheKey(['cat', name.trim().toLowerCase(), catKey])
  const cached = await getAiCallCache(db, cacheKey)
  if (cached && typeof cached.kategorie_id === 'string' && cached.kategorie_id) {
    const ok = categories.some((c) => c.id === cached.kategorie_id)
    if (ok) {
      return {
        kategorie_id: String(cached.kategorie_id),
        begruendung: String(cached.begruendung ?? 'Vorschlag aus früherer Analyse.'),
        quelle: 'ki',
        duplicate: null,
      }
    }
  }

  const list = categories
    .map((c) => `- ${c.id} | ${c.hauptkategorie_titel} / ${c.titel}`)
    .join('\n')
  const result = await chatJson({
    apiKey,
    system: CATEGORY_SYSTEM,
    user: `Gegenstand: ${name}\n\nKategorien:\n${list}`,
    temperature: 0.1,
    trigger: 'auto',
    title: 'Camping Packliste Kategorie',
  })

  const idRaw = result.json.kategorie_id
  const id = idRaw == null || idRaw === '' ? null : String(idRaw)
  if (!id || !categories.some((c) => c.id === id)) return null
  const begruendung = String(result.json.begruendung ?? 'Passend zu eurer Kategoriesystematik.')
  await setAiCallCache(db, cacheKey, { kategorie_id: id, begruendung })
  return { kategorie_id: id, begruendung, quelle: 'ki', duplicate: null }
}

export async function suggestCategoryForName(
  db: D1Database,
  name: string,
  opts: { apiKey?: string | null; allowAi: boolean }
): Promise<CategorySuggestMatch | null> {
  const trimmed = name.trim()
  if (trimmed.length < 2) return null
  const corpus = await loadCategorySuggestCorpus(db)
  const ruled = ruleSuggest(trimmed, corpus)
  if (ruled) return ruled
  if (!opts.allowAi || !opts.apiKey) return null
  return aiSuggest(opts.apiKey, trimmed, corpus.categories, db)
}
