/**
 * Prüft gespeicherte Campingplatz-Daten gegen Google Places und die Website.
 * Schreibt nichts direkt – legt nur Vorschläge (place_update) an.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { fetchGooglePlaceSnapshot } from '@/lib/google-place-details'
import {
  type PlaceChangeField,
  type PlaceFieldChange,
} from '@/lib/place-field-changes'
import { preparePlaceFieldChange } from '@/lib/place-value-normalize'
import { researchPlatzplanFromWebsite } from '@/lib/platzplan-research'
import { upsertSmartSuggestion } from '@/lib/smart-suggestions'

/** Wenige Plätze pro Cron-Lauf – zusammen mit Platzplan-Suche sonst Error 1102. */
const CHECK_LIMIT = 3
const RECRAWL_LIMIT = 1
/** Recrawl nur bei totem Platzplan-Link, und kürzer als die volle Suche. */
const RECRAWL_MAX_PAGES = 6
/** Cron: nur Plätze, die noch nie oder vor mehr als 6 Monaten geprüft wurden. */
const STALE_AFTER_SQL = `datetime('now', '-6 months')`

type CampingplatzCheckRow = {
  id: string
  name: string
  land: string
  bundesland: string | null
  ort: string
  webseite: string | null
  adresse: string | null
  google_place_id: string | null
  telefon: string | null
  oeffnungszeiten: string | null
  platzplan_url: string | null
}

function pushChange(
  changes: PlaceFieldChange[],
  field: PlaceChangeField,
  previous: string | null | undefined,
  proposed: string | null | undefined
) {
  const change = preparePlaceFieldChange(field, previous, proposed)
  if (change) changes.push(change)
}

async function probeUrlStatus(url: string): Promise<number | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 6_000)
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal })
    if (head.status !== 405 && head.status !== 501) return head.status
    /* Kein voller GET: große PDFs würden CPU/Memory sprengen (1102). */
    const ranged = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { Range: 'bytes=0-0' },
    })
    return ranged.status
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function listCampingplaetzeForDataCheck(
  db: D1Database,
  limit = CHECK_LIMIT
): Promise<string[]> {
  const cap = Math.min(Math.max(limit, 1), 12)
  try {
    const res = await db
      .prepare(
        `SELECT id FROM campingplaetze
         WHERE is_archived = 0
           AND (
             daten_geprueft_am IS NULL
             OR TRIM(daten_geprueft_am) = ''
             OR daten_geprueft_am < ${STALE_AFTER_SQL}
           )
         ORDER BY COALESCE(daten_geprueft_am, '1970-01-01') ASC, updated_at ASC
         LIMIT ${cap}`
      )
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  } catch (error) {
    console.error('listCampingplaetzeForDataCheck:', error)
    return []
  }
}

async function markChecked(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `UPDATE campingplaetze SET daten_geprueft_am = datetime('now') WHERE id = ?`
    )
    .bind(id)
    .run()
}

function placeUpdateFingerprint(campingplatzId: string, changes: PlaceFieldChange[]): string {
  const sig = changes
    .map((c) => `${c.field}:${c.proposed}`)
    .sort()
    .join('|')
  let h = 2166136261
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `place_update:${campingplatzId}:${(h >>> 0).toString(16)}`
}

export async function checkCampingplatzForUpdates(
  db: D1Database,
  campingplatzId: string,
  opts: { googleApiKey?: string | null; openRouterKey?: string | null; allowRecrawl?: boolean }
): Promise<{ changes: PlaceFieldChange[]; suggestionId: string | null; recrawled: boolean }> {
  const cp = await db
    .prepare(
      `SELECT id, name, land, bundesland, ort, webseite, adresse, google_place_id, telefon, oeffnungszeiten, platzplan_url
       FROM campingplaetze WHERE id = ?`
    )
    .bind(campingplatzId)
    .first<CampingplatzCheckRow>()
  if (!cp) return { changes: [], suggestionId: null, recrawled: false }

  const changes: PlaceFieldChange[] = []

  if (opts.googleApiKey && cp.google_place_id?.trim()) {
    const snap = await fetchGooglePlaceSnapshot(opts.googleApiKey, cp.google_place_id)
    if (snap) {
      pushChange(changes, 'name', cp.name, snap.name)
      pushChange(changes, 'adresse', cp.adresse, snap.adresse)
      pushChange(changes, 'ort', cp.ort, snap.ort)
      pushChange(changes, 'bundesland', cp.bundesland, snap.bundesland)
      pushChange(changes, 'land', cp.land, snap.land)
      pushChange(changes, 'webseite', cp.webseite, snap.webseite)
      pushChange(changes, 'telefon', cp.telefon, snap.telefon)
      pushChange(changes, 'oeffnungszeiten', cp.oeffnungszeiten, snap.oeffnungszeiten)
    }
  }

  const planUrl = cp.platzplan_url?.trim() ?? ''
  let recrawled = false
  if (planUrl) {
    const status = await probeUrlStatus(planUrl)
    if (status === 404 || status === 410) {
      let replacement: string | null = null
      if (opts.allowRecrawl && cp.webseite?.trim()) {
        const found = await researchPlatzplanFromWebsite(cp.name, cp.webseite, {
          apiKey: opts.openRouterKey ?? null,
          maxPages: RECRAWL_MAX_PAGES,
        })
        recrawled = true
        replacement = found.pickedUrl && found.pickedUrl !== planUrl ? found.pickedUrl : null
      }
      pushChange(changes, 'platzplan_url', planUrl, replacement ?? '')
    }
  }

  await markChecked(db, cp.id)

  if (changes.length === 0) return { changes: [], suggestionId: null, recrawled }

  const summary = changes.map((c) => c.label).join(', ')
  const suggestion = await upsertSmartSuggestion(db, {
    kind: 'place_update',
    fingerprint: placeUpdateFingerprint(cp.id, changes),
    titel: `Aktualisierte Daten: ${cp.name}`,
    begruendung: `Mögliche Änderungen bei ${summary}. Bitte prüfen – es wird nichts automatisch übernommen.`,
    payload: {
      campingplatz_id: cp.id,
      campingplatz_name: cp.name,
      changes,
    },
    kontext_typ: 'campingplatz',
    kontext_id: cp.id,
    quelle: 'regel',
  })
  return { changes, suggestionId: suggestion?.id ?? null, recrawled }
}

export async function processCampingplatzDataChecks(
  db: D1Database,
  opts: {
    googleApiKey?: string | null
    openRouterKey?: string | null
    allowRecrawl?: boolean
  }
): Promise<{ checked: number; withChanges: number }> {
  const ids = await listCampingplaetzeForDataCheck(db, CHECK_LIMIT)
  let withChanges = 0
  let recrawlUsed = 0
  const recrawlBudget = opts.allowRecrawl === false ? 0 : RECRAWL_LIMIT
  for (const id of ids) {
    const allowRecrawl = recrawlUsed < recrawlBudget
    const result = await checkCampingplatzForUpdates(db, id, {
      googleApiKey: opts.googleApiKey ?? null,
      openRouterKey: allowRecrawl ? (opts.openRouterKey ?? null) : null,
      allowRecrawl,
    })
    if (result.recrawled) recrawlUsed += 1
    if (result.changes.length > 0) withChanges += 1
  }
  return { checked: ids.length, withChanges }
}
