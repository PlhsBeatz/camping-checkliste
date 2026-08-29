/**
 * Persistenz und Typen für smarte Vorschläge (Inbox + Heute-Hub).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { addCalendarDays, todayInAppTimezone } from '@/lib/app-timezone'
import { xorSuggestionContentRelated } from '@/lib/xor-relatedness'
import { suggestionInboxHref } from '@/lib/smart-suggestion-focus'

export const SMART_SUGGESTION_KINDS = [
  'packing_add',
  'packing_copack',
  'temp_promote',
  'xor_candidate',
  'platzplan',
  'place_gap',
  'place_update',
] as const

export type SmartSuggestionKind = (typeof SMART_SUGGESTION_KINDS)[number]

export const SMART_SUGGESTION_STATUSES = ['pending', 'accepted', 'dismissed', 'snoozed'] as const
export type SmartSuggestionStatus = (typeof SMART_SUGGESTION_STATUSES)[number]

export const SMART_SUGGESTION_SOURCES = ['regel', 'ki', 'hybrid'] as const
export type SmartSuggestionSource = (typeof SMART_SUGGESTION_SOURCES)[number]

export type SmartSuggestion = {
  id: string
  kind: SmartSuggestionKind
  status: SmartSuggestionStatus
  titel: string
  begruendung: string | null
  payload: Record<string, unknown>
  kontext_typ: string | null
  kontext_id: string | null
  quelle: SmartSuggestionSource
  fingerprint: string
  snoozed_until: string | null
  created_at: string
  updated_at: string
}

function isKind(v: string): v is SmartSuggestionKind {
  return (SMART_SUGGESTION_KINDS as readonly string[]).includes(v)
}

function isStatus(v: string): v is SmartSuggestionStatus {
  return (SMART_SUGGESTION_STATUSES as readonly string[]).includes(v)
}

function isSource(v: string): v is SmartSuggestionSource {
  return (SMART_SUGGESTION_SOURCES as readonly string[]).includes(v)
}

function mapRow(row: Record<string, unknown>): SmartSuggestion | null {
  const kindRaw = String(row.kind ?? '')
  const statusRaw = String(row.status ?? '')
  const quelleRaw = String(row.quelle ?? 'regel')
  if (!isKind(kindRaw) || !isStatus(statusRaw) || !isSource(quelleRaw)) return null
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(String(row.payload_json || '{}')) as Record<string, unknown>
  } catch {
    payload = {}
  }
  return {
    id: String(row.id),
    kind: kindRaw,
    status: statusRaw,
    titel: String(row.titel ?? ''),
    begruendung: row.begruendung != null ? String(row.begruendung) : null,
    payload,
    kontext_typ: row.kontext_typ != null ? String(row.kontext_typ) : null,
    kontext_id: row.kontext_id != null ? String(row.kontext_id) : null,
    quelle: quelleRaw,
    fingerprint: String(row.fingerprint ?? ''),
    snoozed_until: row.snoozed_until != null ? String(row.snoozed_until) : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

export type UpsertSmartSuggestionInput = {
  kind: SmartSuggestionKind
  fingerprint: string
  titel: string
  begruendung?: string | null
  payload?: Record<string, unknown>
  kontext_typ?: string | null
  kontext_id?: string | null
  quelle?: SmartSuggestionSource
}

/** Legt an oder aktualisiert, solange der Vorschlag noch pending/snoozed ist. */
export async function upsertSmartSuggestion(
  db: D1Database,
  input: UpsertSmartSuggestionInput
): Promise<SmartSuggestion | null> {
  const existing = await db
    .prepare(
      `SELECT * FROM smart_vorschlaege WHERE kind = ? AND fingerprint = ?`
    )
    .bind(input.kind, input.fingerprint)
    .first<Record<string, unknown>>()

  if (existing) {
    const mapped = mapRow(existing)
    if (mapped && (mapped.status === 'accepted' || mapped.status === 'dismissed')) {
      return mapped
    }
    await db
      .prepare(
        `UPDATE smart_vorschlaege
         SET titel = ?, begruendung = ?, payload_json = ?, kontext_typ = ?, kontext_id = ?,
             quelle = ?, status = 'pending', snoozed_until = NULL, updated_at = datetime('now')
         WHERE id = ?`
      )
      .bind(
        input.titel,
        input.begruendung ?? null,
        JSON.stringify(input.payload ?? {}),
        input.kontext_typ ?? null,
        input.kontext_id ?? null,
        input.quelle ?? 'regel',
        String(existing.id)
      )
      .run()
    return getSmartSuggestionById(db, String(existing.id))
  }

  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO smart_vorschlaege
       (id, kind, status, titel, begruendung, payload_json, kontext_typ, kontext_id, quelle, fingerprint)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.kind,
      input.titel,
      input.begruendung ?? null,
      JSON.stringify(input.payload ?? {}),
      input.kontext_typ ?? null,
      input.kontext_id ?? null,
      input.quelle ?? 'regel',
      input.fingerprint
    )
    .run()
  return getSmartSuggestionById(db, id)
}

export async function getSmartSuggestionById(
  db: D1Database,
  id: string
): Promise<SmartSuggestion | null> {
  const row = await db
    .prepare('SELECT * FROM smart_vorschlaege WHERE id = ?')
    .bind(id)
    .first<Record<string, unknown>>()
  return row ? mapRow(row) : null
}

export async function listSmartSuggestions(
  db: D1Database,
  opts?: {
    status?: SmartSuggestionStatus | 'open'
    kind?: SmartSuggestionKind
    kontextId?: string
    limit?: number
  }
): Promise<SmartSuggestion[]> {
  const today = todayInAppTimezone()
  const clauses: string[] = []
  const binds: string[] = []

  if (opts?.status === 'open') {
    clauses.push(
      `(status = 'pending' OR (status = 'snoozed' AND (snoozed_until IS NULL OR snoozed_until <= ?)))`
    )
    binds.push(today)
  } else if (opts?.status) {
    clauses.push('status = ?')
    binds.push(opts.status)
  }

  if (opts?.kind) {
    clauses.push('kind = ?')
    binds.push(opts.kind)
  } else {
    // place_gap ist nur internes Such-Protokoll, keine Inbox-Karte
    clauses.push(`kind != 'place_gap'`)
  }
  if (opts?.kontextId) {
    clauses.push('kontext_id = ?')
    binds.push(opts.kontextId)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
  const sql = `SELECT * FROM smart_vorschlaege ${where} ORDER BY created_at DESC LIMIT ${limit}`

  try {
    const res =
      binds.length > 0
        ? await db.prepare(sql).bind(...binds).all<Record<string, unknown>>()
        : await db.prepare(sql).all<Record<string, unknown>>()
    return (res.results || [])
      .map(mapRow)
      .filter((s): s is SmartSuggestion => s != null)
      .filter((s) => s.kind !== 'xor_candidate' || xorSuggestionContentRelated(s.payload, s.titel))
  } catch (error) {
    console.error('listSmartSuggestions:', error)
    return []
  }
}

export async function countOpenSmartSuggestions(db: D1Database): Promise<number> {
  const today = todayInAppTimezone()
  const openSql = `(status = 'pending' OR (status = 'snoozed' AND (snoozed_until IS NULL OR snoozed_until <= ?)))`
  try {
    const [countRes, xorRes] = await db.batch([
      db
        .prepare(
          `SELECT COUNT(*) as n FROM smart_vorschlaege
           WHERE ${openSql} AND kind != 'place_gap' AND kind != 'xor_candidate'`
        )
        .bind(today),
      db
        .prepare(
          `SELECT payload, titel FROM smart_vorschlaege
           WHERE ${openSql} AND kind = 'xor_candidate'`
        )
        .bind(today),
    ])
    const n = Number((countRes.results?.[0] as { n?: number } | undefined)?.n ?? 0)
    let xorOk = 0
    for (const row of xorRes.results ?? []) {
      const raw = row as { payload?: string; titel?: string }
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(String(raw.payload ?? '{}')) as Record<string, unknown>
      } catch {
        payload = {}
      }
      if (xorSuggestionContentRelated(payload, raw.titel)) xorOk++
    }
    return n + xorOk
  } catch (error) {
    console.error('countOpenSmartSuggestions:', error)
    return 0
  }
}

export async function setSmartSuggestionStatus(
  db: D1Database,
  id: string,
  status: SmartSuggestionStatus,
  snoozedUntil?: string | null
): Promise<SmartSuggestion | null> {
  await db
    .prepare(
      `UPDATE smart_vorschlaege
       SET status = ?, snoozed_until = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(status, snoozedUntil ?? null, id)
    .run()
  return getSmartSuggestionById(db, id)
}

export async function snoozeSmartSuggestion(
  db: D1Database,
  id: string,
  days: number
): Promise<SmartSuggestion | null> {
  const until = addCalendarDays(todayInAppTimezone(), days)
  return setSmartSuggestionStatus(db, id, 'snoozed', until)
}

export function suggestionHref(s: SmartSuggestion): string {
  if (s.kind === 'platzplan' || s.kind === 'packing_add' || s.kind === 'packing_copack') {
    return suggestionInboxHref(s.id)
  }
  if (s.kind === 'place_gap') {
    const cpId = String(s.payload.campingplatz_id ?? s.kontext_id ?? '')
    return cpId ? `/campingplaetze/${encodeURIComponent(cpId)}` : '/campingplaetze'
  }
  if (s.kind === 'place_update') {
    const cpId = String(s.payload.campingplatz_id ?? s.kontext_id ?? '')
    return cpId
      ? `/campingplaetze/${encodeURIComponent(cpId)}?bearbeiten=1&vorschlag=${encodeURIComponent(s.id)}`
      : '/campingplaetze'
  }
  if (s.kind === 'temp_promote') return '/ausruestung'
  if (s.kontext_typ === 'vacation' && s.kontext_id) {
    return `/packliste?vacation=${encodeURIComponent(s.kontext_id)}`
  }
  return suggestionInboxHref(s.id)
}

export function suggestionAdminOnly(kind: SmartSuggestionKind): boolean {
  return kind === 'xor_candidate' || kind === 'platzplan' || kind === 'place_gap' || kind === 'place_update'
}
