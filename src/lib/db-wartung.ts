/**
 * D1 CRUD für Wartung: Fälligkeiten und Historie.
 */
import type { D1Database } from '@cloudflare/workers-types'
import {
  computeAmpelStatus,
  computePersistedFaelligkeitFields,
  type FaelligkeitAmpelStatus,
  type FaelligkeitEreignisTyp,
  type FaelligkeitIntervallEinheit,
  type FaelligkeitIntervallRhythmus,
  type FaelligkeitKategorie,
  type FaelligkeitTyp,
  normalizeFaelligkeitTyp,
  normalizeIntervallRhythmus,
} from '@/lib/faelligkeit-status'
import { normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import { faelligkeitToHistorieInitial } from '@/lib/faelligkeit-historie-utils'

export type {
  FaelligkeitAmpelStatus,
  FaelligkeitEreignisTyp,
  FaelligkeitIntervallEinheit,
  FaelligkeitIntervallRhythmus,
  FaelligkeitKategorie,
  FaelligkeitTyp,
} from '@/lib/faelligkeit-status'

export interface Faelligkeit {
  id: string
  name: string
  kategorie: FaelligkeitKategorie
  typ: FaelligkeitTyp
  equipment_id: string | null
  transport_id: string | null
  bezug_datum: string | null
  gueltig_bis: string | null
  letzte_erledigung_am: string | null
  initial_erledigung_am: string | null
  naechste_faelligkeit: string | null
  intervall_einheit: FaelligkeitIntervallEinheit | null
  intervall_wert: number | null
  intervall_rhythmus: FaelligkeitIntervallRhythmus
  warnung_tage_vorher: number
  sicherheitsrelevant: boolean
  quittierung_erforderlich: boolean
  push_reminder_sent: boolean
  push_due_sent: boolean
  notizen: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
  equipment_was?: string | null
  transport_name?: string | null
  ampel_status?: FaelligkeitAmpelStatus
}

export interface FaelligkeitHistorie {
  id: string
  faelligkeit_id: string
  ereignis_typ: FaelligkeitEreignisTyp
  datum: string
  user_id: string | null
  notiz: string | null
  created_at: string
  user_name?: string | null
}

export interface FaelligkeitHistorieInitial {
  angelegt_am: string
  typ: FaelligkeitTyp
  bezug_datum: string | null
  gueltig_bis: string | null
  initial_erledigung_am: string | null
  naechste_faelligkeit: string | null
  intervall_einheit: FaelligkeitIntervallEinheit | null
  intervall_wert: number | null
  notizen: string | null
}

export interface FaelligkeitHistorieView {
  initial: FaelligkeitHistorieInitial
  entries: FaelligkeitHistorie[]
}

export interface FaelligkeitDashboard {
  ueberfaellig: Faelligkeit[]
  bald_faellig: Faelligkeit[]
  ok: Faelligkeit[]
  nur_info: Faelligkeit[]
}

const FAELLIGKEIT_SELECT = `
  SELECT f.id, f.name, f.kategorie, f.typ,
         f.equipment_id, f.transport_id,
         f.bezug_datum, f.gueltig_bis, f.letzte_erledigung_am, f.initial_erledigung_am, f.naechste_faelligkeit,
         f.intervall_einheit, f.intervall_wert, f.intervall_rhythmus, f.warnung_tage_vorher,
         f.sicherheitsrelevant, f.quittierung_erforderlich, f.push_reminder_sent, f.push_due_sent,
         f.notizen, f.is_archived, f.created_at, f.updated_at,
         a.was AS equipment_was,
         t.name AS transport_name
  FROM faelligkeiten f
  LEFT JOIN ausruestungsgegenstaende a ON a.id = f.equipment_id
  LEFT JOIN transportmittel t ON t.id = f.transport_id
`

const HISTORIE_SELECT = `
  SELECT h.id, h.faelligkeit_id, h.ereignis_typ, h.datum, h.user_id, h.notiz, h.created_at,
         COALESCE(m.name, u.email) AS user_name
  FROM faelligkeiten_historie h
  LEFT JOIN users u ON u.id = h.user_id
  LEFT JOIN mitreisende m ON m.id = u.mitreisender_id
`

function mapFaelligkeitRow(row: Record<string, unknown>): Faelligkeit {
  const item: Faelligkeit = {
    id: String(row.id),
    name: String(row.name),
    kategorie: String(row.kategorie) as FaelligkeitKategorie,
    typ: normalizeFaelligkeitTyp(String(row.typ)),
    equipment_id: row.equipment_id != null ? String(row.equipment_id) : null,
    transport_id: row.transport_id != null ? String(row.transport_id) : null,
    bezug_datum: row.bezug_datum != null ? String(row.bezug_datum) : null,
    gueltig_bis: row.gueltig_bis != null ? String(row.gueltig_bis) : null,
    letzte_erledigung_am:
      row.letzte_erledigung_am != null ? String(row.letzte_erledigung_am) : null,
    initial_erledigung_am:
      row.initial_erledigung_am != null ? String(row.initial_erledigung_am) : null,
    naechste_faelligkeit:
      row.naechste_faelligkeit != null ? String(row.naechste_faelligkeit) : null,
    intervall_einheit:
      row.intervall_einheit != null
        ? (String(row.intervall_einheit) as FaelligkeitIntervallEinheit)
        : null,
    intervall_wert: row.intervall_wert != null ? Number(row.intervall_wert) : null,
    intervall_rhythmus: normalizeIntervallRhythmus(
      row.intervall_rhythmus != null
        ? (String(row.intervall_rhythmus) as FaelligkeitIntervallRhythmus)
        : null
    ),
    warnung_tage_vorher: Number(row.warnung_tage_vorher ?? 30),
    sicherheitsrelevant: !!(row.sicherheitsrelevant ?? 0),
    quittierung_erforderlich: !!(row.quittierung_erforderlich ?? 0),
    push_reminder_sent: !!(row.push_reminder_sent ?? 0),
    push_due_sent: !!(row.push_due_sent ?? 0),
    notizen: row.notizen != null ? String(row.notizen) : null,
    is_archived: !!(row.is_archived ?? 0),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    equipment_was: row.equipment_was != null ? String(row.equipment_was) : null,
    transport_name: row.transport_name != null ? String(row.transport_name) : null,
  }
  item.ampel_status = computeAmpelStatus(item)
  return item
}

function mapHistorieRow(row: Record<string, unknown>): FaelligkeitHistorie {
  return {
    id: String(row.id),
    faelligkeit_id: String(row.faelligkeit_id),
    ereignis_typ: String(row.ereignis_typ) as FaelligkeitEreignisTyp,
    datum: String(row.datum),
    user_id: row.user_id != null ? String(row.user_id) : null,
    notiz: row.notiz != null ? String(row.notiz) : null,
    created_at: String(row.created_at || ''),
    user_name: row.user_name != null ? String(row.user_name) : null,
  }
}

export async function getFaelligkeiten(
  db: D1Database,
  options?: { includeArchived?: boolean; equipmentId?: string; transportId?: string }
): Promise<Faelligkeit[]> {
  try {
    const conditions: string[] = []
    const binds: string[] = []
    if (!options?.includeArchived) {
      conditions.push('f.is_archived = 0')
    }
    if (options?.equipmentId) {
      conditions.push('f.equipment_id = ?')
      binds.push(options.equipmentId)
    }
    if (options?.transportId) {
      conditions.push('f.transport_id = ?')
      binds.push(options.transportId)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const res = await db
      .prepare(
        `${FAELLIGKEIT_SELECT} ${where}
         ORDER BY
           CASE WHEN f.naechste_faelligkeit IS NULL THEN 1 ELSE 0 END,
           f.naechste_faelligkeit ASC,
           f.name COLLATE NOCASE ASC`
      )
      .bind(...binds)
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapFaelligkeitRow)
  } catch (error) {
    console.error('Error getFaelligkeiten:', error)
    return []
  }
}

/** Hub/Attention: ohne Equipment-/Transport-Joins (nur Ampel + Name). */
export async function getFaelligkeitenForHub(db: D1Database): Promise<Faelligkeit[]> {
  try {
    const res = await db
      .prepare(
        `SELECT f.id, f.name, f.kategorie, f.typ,
                f.equipment_id, f.transport_id,
                f.bezug_datum, f.gueltig_bis, f.letzte_erledigung_am, f.initial_erledigung_am, f.naechste_faelligkeit,
                f.intervall_einheit, f.intervall_wert, f.intervall_rhythmus, f.warnung_tage_vorher,
                f.sicherheitsrelevant, f.is_archived
         FROM faelligkeiten f
         WHERE f.is_archived = 0
         ORDER BY
           CASE WHEN f.naechste_faelligkeit IS NULL THEN 1 ELSE 0 END,
           f.naechste_faelligkeit ASC,
           f.name COLLATE NOCASE ASC`
      )
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapFaelligkeitRow)
  } catch (error) {
    console.error('Error getFaelligkeitenForHub:', error)
    return []
  }
}

export async function getFaelligkeit(db: D1Database, id: string): Promise<Faelligkeit | null> {
  try {
    const row = await db
      .prepare(`${FAELLIGKEIT_SELECT} WHERE f.id = ?`)
      .bind(id)
      .first<Record<string, unknown>>()
    if (!row) return null
    return mapFaelligkeitRow(row)
  } catch (error) {
    console.error('Error getFaelligkeit:', error)
    return null
  }
}

export async function getFaelligkeitDashboard(db: D1Database): Promise<FaelligkeitDashboard> {
  const items = await getFaelligkeiten(db)
  const dashboard: FaelligkeitDashboard = {
    ueberfaellig: [],
    bald_faellig: [],
    ok: [],
    nur_info: [],
  }
  for (const item of items) {
    const status = item.ampel_status ?? 'ok'
    dashboard[status].push(item)
  }
  return dashboard
}

/** Alle Fälligkeiten mit Ausrüstungs-Zuordnung (ohne ID-Liste, z. B. für Ausrüstungs-Übersicht). */
export async function getAllFaelligkeitEquipmentLinks(db: D1Database): Promise<{
  ampel: Map<string, FaelligkeitAmpelStatus>
  faelligkeitId: Map<string, string>
}> {
  const ampel = new Map<string, FaelligkeitAmpelStatus>()
  const faelligkeitId = new Map<string, string>()
  try {
    const res = await db
      .prepare(
        `${FAELLIGKEIT_SELECT}
         WHERE f.is_archived = 0 AND f.equipment_id IS NOT NULL`
      )
      .all<Record<string, unknown>>()
    const rank: Record<FaelligkeitAmpelStatus, number> = {
      ueberfaellig: 4,
      bald_faellig: 3,
      ok: 2,
      nur_info: 1,
    }
    for (const row of res.results || []) {
      const item = mapFaelligkeitRow(row)
      if (!item.equipment_id) continue
      const prev = ampel.get(item.equipment_id)
      const status = item.ampel_status ?? 'ok'
      if (!prev || rank[status] > rank[prev]) {
        ampel.set(item.equipment_id, status)
        faelligkeitId.set(item.equipment_id, item.id)
      }
    }
  } catch (error) {
    console.error('Error getAllFaelligkeitEquipmentLinks:', error)
  }
  return { ampel, faelligkeitId }
}

/** Batch: schlechtester Ampel-Status und zugehörige Fälligkeit pro equipment_id. */
export async function getFaelligkeitSummaryByEquipmentIds(
  db: D1Database,
  equipmentIds: string[]
): Promise<{
  ampel: Map<string, FaelligkeitAmpelStatus>
  faelligkeitId: Map<string, string>
}> {
  const ampel = new Map<string, FaelligkeitAmpelStatus>()
  const faelligkeitId = new Map<string, string>()
  if (equipmentIds.length === 0) return { ampel, faelligkeitId }
  const unique = [...new Set(equipmentIds)]
  const placeholders = unique.map(() => '?').join(', ')
  try {
    const res = await db
      .prepare(
        `${FAELLIGKEIT_SELECT}
         WHERE f.is_archived = 0 AND f.equipment_id IN (${placeholders})`
      )
      .bind(...unique)
      .all<Record<string, unknown>>()
    const rank: Record<FaelligkeitAmpelStatus, number> = {
      ueberfaellig: 4,
      bald_faellig: 3,
      ok: 2,
      nur_info: 1,
    }
    for (const row of res.results || []) {
      const item = mapFaelligkeitRow(row)
      if (!item.equipment_id) continue
      const prev = ampel.get(item.equipment_id)
      const status = item.ampel_status ?? 'ok'
      if (!prev || rank[status] > rank[prev]) {
        ampel.set(item.equipment_id, status)
        faelligkeitId.set(item.equipment_id, item.id)
      }
    }
  } catch (error) {
    console.error('Error getFaelligkeitSummaryByEquipmentIds:', error)
  }
  return { ampel, faelligkeitId }
}

/** Batch: schlechtester Ampel-Status pro equipment_id (für Badge). */
export async function getFaelligkeitAmpelByEquipmentIds(
  db: D1Database,
  equipmentIds: string[]
): Promise<Map<string, FaelligkeitAmpelStatus>> {
  const { ampel } = await getFaelligkeitSummaryByEquipmentIds(db, equipmentIds)
  return ampel
}

/** Anzahl Fälligkeiten pro transport_id. */
export async function getFaelligkeitCountByTransportIds(
  db: D1Database,
  transportIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (transportIds.length === 0) return map
  const unique = [...new Set(transportIds)]
  const placeholders = unique.map(() => '?').join(', ')
  try {
    const res = await db
      .prepare(
        `SELECT transport_id, COUNT(*) AS cnt
         FROM faelligkeiten
         WHERE is_archived = 0 AND transport_id IN (${placeholders})
         GROUP BY transport_id`
      )
      .bind(...unique)
      .all<{ transport_id: string; cnt: number }>()
    for (const row of res.results || []) {
      map.set(String(row.transport_id), Number(row.cnt))
    }
  } catch (error) {
    console.error('Error getFaelligkeitCountByTransportIds:', error)
  }
  return map
}

export async function createFaelligkeit(
  db: D1Database,
  data: {
    name: string
    kategorie?: FaelligkeitKategorie
    typ: FaelligkeitTyp
    equipment_id?: string | null
    transport_id?: string | null
    bezug_datum?: string | null
    gueltig_bis?: string | null
    letzte_erledigung_am?: string | null
    intervall_einheit?: FaelligkeitIntervallEinheit | null
    intervall_wert?: number | null
    intervall_rhythmus?: FaelligkeitIntervallRhythmus | null
    warnung_tage_vorher?: number
    sicherheitsrelevant?: boolean
    quittierung_erforderlich?: boolean
    notizen?: string | null
  }
): Promise<Faelligkeit | null> {
  try {
    const id = crypto.randomUUID()
    const persisted = computePersistedFaelligkeitFields({
      typ: data.typ,
      bezug_datum: data.bezug_datum,
      gueltig_bis: data.gueltig_bis,
      letzte_erledigung_am: data.letzte_erledigung_am,
      intervall_einheit: data.intervall_einheit,
      intervall_wert: data.intervall_wert,
      intervall_rhythmus: normalizeIntervallRhythmus(data.intervall_rhythmus),
    })
    await db
      .prepare(
        `INSERT INTO faelligkeiten (
          id, name, kategorie, typ, equipment_id, transport_id,
          bezug_datum, gueltig_bis, letzte_erledigung_am, initial_erledigung_am, naechste_faelligkeit,
          intervall_einheit, intervall_wert, intervall_rhythmus, warnung_tage_vorher,
          sicherheitsrelevant, quittierung_erforderlich, notizen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.name,
        data.kategorie ?? 'sonstiges',
        data.typ,
        data.equipment_id ?? null,
        data.transport_id ?? null,
        data.bezug_datum ? normalizeCalendarDate(data.bezug_datum) : null,
        persisted.gueltig_bis,
        data.letzte_erledigung_am ? normalizeCalendarDate(data.letzte_erledigung_am) : null,
        data.letzte_erledigung_am ? normalizeCalendarDate(data.letzte_erledigung_am) : null,
        persisted.naechste_faelligkeit,
        data.intervall_einheit ?? null,
        data.intervall_wert ?? null,
        normalizeIntervallRhythmus(data.intervall_rhythmus),
        data.warnung_tage_vorher ?? 30,
        data.sicherheitsrelevant ? 1 : 0,
        data.quittierung_erforderlich ? 1 : 0,
        data.notizen ?? null
      )
      .run()
    return getFaelligkeit(db, id)
  } catch (error) {
    console.error('Error createFaelligkeit:', error)
    return null
  }
}

export async function updateFaelligkeit(
  db: D1Database,
  id: string,
  updates: Partial<{
    name: string
    kategorie: FaelligkeitKategorie
    typ: FaelligkeitTyp
    equipment_id: string | null
    transport_id: string | null
    bezug_datum: string | null
    gueltig_bis: string | null
    letzte_erledigung_am: string | null
    intervall_einheit: FaelligkeitIntervallEinheit | null
    intervall_wert: number | null
    intervall_rhythmus: FaelligkeitIntervallRhythmus | null
    warnung_tage_vorher: number
    sicherheitsrelevant: boolean
    quittierung_erforderlich: boolean
    notizen: string | null
    is_archived: boolean
    push_reminder_sent: boolean
    push_due_sent: boolean
  }>
): Promise<Faelligkeit | null> {
  try {
    const existing = await getFaelligkeit(db, id)
    if (!existing) return null

    const merged = {
      typ: updates.typ ?? existing.typ,
      bezug_datum:
        updates.bezug_datum !== undefined ? updates.bezug_datum : existing.bezug_datum,
      gueltig_bis:
        updates.gueltig_bis !== undefined ? updates.gueltig_bis : existing.gueltig_bis,
      letzte_erledigung_am:
        updates.letzte_erledigung_am !== undefined
          ? updates.letzte_erledigung_am
          : existing.letzte_erledigung_am,
      intervall_einheit:
        updates.intervall_einheit !== undefined
          ? updates.intervall_einheit
          : existing.intervall_einheit,
      intervall_wert:
        updates.intervall_wert !== undefined ? updates.intervall_wert : existing.intervall_wert,
      intervall_rhythmus:
        updates.intervall_rhythmus !== undefined
          ? updates.intervall_rhythmus
          : existing.intervall_rhythmus,
    }
    const persisted = computePersistedFaelligkeitFields(merged)

    const fields: string[] = []
    const values: (string | number | null)[] = []

    const setField = (col: string, val: string | number | null) => {
      fields.push(`${col} = ?`)
      values.push(val)
    }

    if (updates.name !== undefined) setField('name', updates.name)
    if (updates.kategorie !== undefined) setField('kategorie', updates.kategorie)
    if (updates.typ !== undefined) setField('typ', updates.typ)
    if (updates.equipment_id !== undefined) setField('equipment_id', updates.equipment_id)
    if (updates.transport_id !== undefined) setField('transport_id', updates.transport_id)
    if (updates.bezug_datum !== undefined) {
      setField('bezug_datum', updates.bezug_datum ? normalizeCalendarDate(updates.bezug_datum) : null)
    }
    if (
      updates.gueltig_bis !== undefined ||
      updates.typ !== undefined ||
      updates.bezug_datum !== undefined ||
      updates.intervall_einheit !== undefined ||
      updates.intervall_wert !== undefined
    ) {
      setField('gueltig_bis', persisted.gueltig_bis)
    }
    if (updates.letzte_erledigung_am !== undefined) {
      setField(
        'letzte_erledigung_am',
        updates.letzte_erledigung_am
          ? normalizeCalendarDate(updates.letzte_erledigung_am)
          : null
      )
    }
    if (
      updates.letzte_erledigung_am !== undefined ||
      updates.typ !== undefined ||
      updates.intervall_einheit !== undefined ||
      updates.intervall_wert !== undefined ||
      updates.intervall_rhythmus !== undefined ||
      updates.gueltig_bis !== undefined ||
      updates.bezug_datum !== undefined
    ) {
      setField('naechste_faelligkeit', persisted.naechste_faelligkeit)
    }
    if (updates.intervall_einheit !== undefined) {
      setField('intervall_einheit', updates.intervall_einheit)
    }
    if (updates.intervall_wert !== undefined) setField('intervall_wert', updates.intervall_wert)
    if (updates.intervall_rhythmus !== undefined) {
      setField('intervall_rhythmus', normalizeIntervallRhythmus(updates.intervall_rhythmus))
    }
    if (updates.warnung_tage_vorher !== undefined) {
      setField('warnung_tage_vorher', updates.warnung_tage_vorher)
    }
    if (updates.sicherheitsrelevant !== undefined) {
      setField('sicherheitsrelevant', updates.sicherheitsrelevant ? 1 : 0)
    }
    if (updates.quittierung_erforderlich !== undefined) {
      setField('quittierung_erforderlich', updates.quittierung_erforderlich ? 1 : 0)
    }
    if (updates.notizen !== undefined) setField('notizen', updates.notizen)
    if (updates.is_archived !== undefined) setField('is_archived', updates.is_archived ? 1 : 0)
    if (updates.push_reminder_sent !== undefined) {
      setField('push_reminder_sent', updates.push_reminder_sent ? 1 : 0)
    }
    if (updates.push_due_sent !== undefined) {
      setField('push_due_sent', updates.push_due_sent ? 1 : 0)
    }

    if (fields.length === 0) return existing

    values.push(id)
    await db.prepare(`UPDATE faelligkeiten SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    return getFaelligkeit(db, id)
  } catch (error) {
    console.error('Error updateFaelligkeit:', error)
    return null
  }
}

export type EquipmentFaelligkeitDisposition =
  | 'keep'
  | 'archive'
  | 'transfer'
  | 'archive_and_create'

export async function applyEquipmentFaelligkeitDisposition(
  db: D1Database,
  sourceEquipmentId: string,
  disposition: EquipmentFaelligkeitDisposition,
  opts?: { successorId?: string; successorAnschaffungsdatum?: string | null }
): Promise<boolean> {
  if (disposition === 'keep') return true
  const open = await getFaelligkeiten(db, { equipmentId: sourceEquipmentId })
  if (open.length === 0) return true

  try {
    if (disposition === 'archive') {
      for (const item of open) {
        const updated = await updateFaelligkeit(db, item.id, { is_archived: true })
        if (!updated) return false
      }
      return true
    }

    const successorId = opts?.successorId
    if (!successorId) return false
    const successorBezug = opts?.successorAnschaffungsdatum
      ? normalizeCalendarDate(opts.successorAnschaffungsdatum)
      : null

    if (disposition === 'transfer') {
      for (const item of open) {
        const patch: Parameters<typeof updateFaelligkeit>[2] = { equipment_id: successorId }
        if (item.typ === 'alter_anzeige' && successorBezug) {
          patch.bezug_datum = successorBezug
        }
        const updated = await updateFaelligkeit(db, item.id, patch)
        if (!updated) return false
      }
      return true
    }

    for (const item of open) {
      const archived = await updateFaelligkeit(db, item.id, { is_archived: true })
      if (!archived) return false
      const created = await createFaelligkeit(db, {
        name: item.name,
        kategorie: item.kategorie,
        typ: item.typ,
        equipment_id: successorId,
        transport_id: item.transport_id,
        bezug_datum:
          item.typ === 'alter_anzeige' ? successorBezug || item.bezug_datum : item.bezug_datum,
        gueltig_bis: item.gueltig_bis,
        letzte_erledigung_am:
          item.typ === 'intervall' ? todayInAppTimezone() : item.letzte_erledigung_am,
        intervall_einheit: item.intervall_einheit,
        intervall_wert: item.intervall_wert,
        intervall_rhythmus: item.intervall_rhythmus,
        warnung_tage_vorher: item.warnung_tage_vorher,
        sicherheitsrelevant: item.sicherheitsrelevant,
        quittierung_erforderlich: item.quittierung_erforderlich,
        notizen: item.notizen,
      })
      if (!created) return false
    }
    return true
  } catch (error) {
    console.error('Error applyEquipmentFaelligkeitDisposition:', error)
    return false
  }
}

export async function deleteFaelligkeit(db: D1Database, id: string): Promise<boolean> {
  try {
    const r = await db.prepare('DELETE FROM faelligkeiten WHERE id = ?').bind(id).run()
    return r.success && (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error deleteFaelligkeit:', error)
    return false
  }
}

export async function getFaelligkeitHistorieView(
  db: D1Database,
  faelligkeitId: string,
  limit = 50,
  offset = 0
): Promise<FaelligkeitHistorieView | null> {
  const faelligkeit = await getFaelligkeit(db, faelligkeitId)
  if (!faelligkeit) return null
  const entries = await getFaelligkeitHistorie(db, faelligkeitId, limit, offset)
  return {
    initial: faelligkeitToHistorieInitial(faelligkeit),
    entries,
  }
}

export async function getFaelligkeitHistorie(
  db: D1Database,
  faelligkeitId: string,
  limit = 50,
  offset = 0
): Promise<FaelligkeitHistorie[]> {
  try {
    const res = await db
      .prepare(
        `${HISTORIE_SELECT}
         WHERE h.faelligkeit_id = ?
         ORDER BY h.datum DESC, h.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(faelligkeitId, limit, offset)
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapHistorieRow)
  } catch (error) {
    console.error('Error getFaelligkeitHistorie:', error)
    return []
  }
}

export async function getFaelligkeitHistorieEntry(
  db: D1Database,
  id: string
): Promise<FaelligkeitHistorie | null> {
  try {
    const row = await db
      .prepare(`${HISTORIE_SELECT} WHERE h.id = ?`)
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapHistorieRow(row) : null
  } catch (error) {
    console.error('Error getFaelligkeitHistorieEntry:', error)
    return null
  }
}

async function getFaelligkeitHistorieRow(
  db: D1Database,
  id: string
): Promise<FaelligkeitHistorie | null> {
  return getFaelligkeitHistorieEntry(db, id)
}

async function recomputeLetzteErledigungFromHistorie(
  db: D1Database,
  faelligkeitId: string
): Promise<void> {
  const row = await db
    .prepare(
      `SELECT datum FROM faelligkeiten_historie
       WHERE faelligkeit_id = ? AND ereignis_typ IN ('erledigt', 'quittiert')
       ORDER BY datum DESC, created_at DESC
       LIMIT 1`
    )
    .bind(faelligkeitId)
    .first<{ datum: string }>()

  await updateFaelligkeit(db, faelligkeitId, {
    letzte_erledigung_am: row ? normalizeCalendarDate(row.datum) : null,
    push_reminder_sent: false,
    push_due_sent: false,
  })
}

function historieAffectsLetzteErledigung(ereignisTyp: FaelligkeitEreignisTyp): boolean {
  return ereignisTyp === 'erledigt' || ereignisTyp === 'quittiert'
}

export async function addFaelligkeitHistorie(
  db: D1Database,
  data: {
    faelligkeit_id: string
    ereignis_typ: FaelligkeitEreignisTyp
    datum?: string
    user_id?: string | null
    notiz?: string | null
    updateLetzteErledigung?: boolean
    bezug_datum?: string | null
    gueltig_bis?: string | null
  }
): Promise<FaelligkeitHistorie | null> {
  try {
    const id = crypto.randomUUID()
    const datum = data.datum ? normalizeCalendarDate(data.datum) : todayInAppTimezone()
    await db
      .prepare(
        `INSERT INTO faelligkeiten_historie (id, faelligkeit_id, ereignis_typ, datum, user_id, notiz)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, data.faelligkeit_id, data.ereignis_typ, datum, data.user_id ?? null, data.notiz ?? null)
      .run()

    if (
      data.updateLetzteErledigung !== false &&
      historieAffectsLetzteErledigung(data.ereignis_typ)
    ) {
      const patch: Parameters<typeof updateFaelligkeit>[2] = {
        letzte_erledigung_am: datum,
        push_reminder_sent: false,
        push_due_sent: false,
      }

      if (data.ereignis_typ === 'erledigt') {
        const faelligkeit = await getFaelligkeit(db, data.faelligkeit_id)
        if (faelligkeit?.typ === 'alter_anzeige') {
          if (data.bezug_datum !== undefined) {
            patch.bezug_datum = data.bezug_datum
              ? normalizeCalendarDate(data.bezug_datum)
              : null
          }
          if (data.gueltig_bis !== undefined) {
            patch.gueltig_bis = data.gueltig_bis
              ? normalizeCalendarDate(data.gueltig_bis)
              : null
          }
        }
      }

      await updateFaelligkeit(db, data.faelligkeit_id, patch)
    }

    const row = await db
      .prepare(`${HISTORIE_SELECT} WHERE h.id = ?`)
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapHistorieRow(row) : null
  } catch (error) {
    console.error('Error addFaelligkeitHistorie:', error)
    return null
  }
}

export async function updateFaelligkeitHistorie(
  db: D1Database,
  id: string,
  updates: {
    ereignis_typ?: FaelligkeitEreignisTyp
    datum?: string
    notiz?: string | null
  }
): Promise<FaelligkeitHistorie | null> {
  try {
    const existing = await getFaelligkeitHistorieRow(db, id)
    if (!existing) return null

    const fields: string[] = []
    const values: (string | null)[] = []
    const nextTyp = updates.ereignis_typ ?? existing.ereignis_typ

    if (updates.ereignis_typ !== undefined) {
      fields.push('ereignis_typ = ?')
      values.push(updates.ereignis_typ)
    }
    if (updates.datum !== undefined) {
      fields.push('datum = ?')
      values.push(normalizeCalendarDate(updates.datum))
    }
    if (updates.notiz !== undefined) {
      fields.push('notiz = ?')
      values.push(updates.notiz)
    }

    if (fields.length === 0) return existing

    values.push(id)
    await db
      .prepare(`UPDATE faelligkeiten_historie SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()

    if (
      historieAffectsLetzteErledigung(existing.ereignis_typ) ||
      historieAffectsLetzteErledigung(nextTyp)
    ) {
      await recomputeLetzteErledigungFromHistorie(db, existing.faelligkeit_id)
    }

    return getFaelligkeitHistorieRow(db, id)
  } catch (error) {
    console.error('Error updateFaelligkeitHistorie:', error)
    return null
  }
}

export async function deleteFaelligkeitHistorie(db: D1Database, id: string): Promise<boolean> {
  try {
    const existing = await getFaelligkeitHistorieRow(db, id)
    if (!existing) return false

    const r = await db.prepare('DELETE FROM faelligkeiten_historie WHERE id = ?').bind(id).run()
    if ((r.meta.changes ?? 0) === 0) return false

    if (historieAffectsLetzteErledigung(existing.ereignis_typ)) {
      await recomputeLetzteErledigungFromHistorie(db, existing.faelligkeit_id)
    }
    return true
  } catch (error) {
    console.error('Error deleteFaelligkeitHistorie:', error)
    return false
  }
}

export async function getWartungStatusForIntegration(db: D1Database): Promise<{
  overdue_count: number
  due_soon_count: number
  items: Array<{
    id: string
    name: string
    ampel_status: FaelligkeitAmpelStatus
    naechste_faelligkeit: string | null
  }>
}> {
  const items = await getFaelligkeiten(db)
  const relevant = items.filter((i) => i.ampel_status === 'ueberfaellig' || i.ampel_status === 'bald_faellig')
  return {
    overdue_count: items.filter((i) => i.ampel_status === 'ueberfaellig').length,
    due_soon_count: items.filter((i) => i.ampel_status === 'bald_faellig').length,
    items: relevant.slice(0, 20).map((i) => ({
      id: i.id,
      name: i.name,
      ampel_status: i.ampel_status ?? 'ok',
      naechste_faelligkeit: i.naechste_faelligkeit,
    })),
  }
}

export async function listFaelligkeitenDueForPush(
  db: D1Database
): Promise<Faelligkeit[]> {
  const today = todayInAppTimezone()
  try {
    const res = await db
      .prepare(
        `${FAELLIGKEIT_SELECT}
         WHERE f.is_archived = 0
           AND f.naechste_faelligkeit IS NOT NULL
           AND f.naechste_faelligkeit != ''
           AND COALESCE(f.push_reminder_sent, 0) = 0
           AND julianday(f.naechste_faelligkeit) - julianday(?) <= f.warnung_tage_vorher`
      )
      .bind(today)
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapFaelligkeitRow)
  } catch (error) {
    console.error('Error listFaelligkeitenDueForPush:', error)
    return []
  }
}

/** Fälligkeiten, deren Fälligkeitstag erreicht oder überschritten ist (Webhook „due“). */
export async function listFaelligkeitenDueForWebhook(
  db: D1Database
): Promise<Faelligkeit[]> {
  const today = todayInAppTimezone()
  try {
    const res = await db
      .prepare(
        `${FAELLIGKEIT_SELECT}
         WHERE f.is_archived = 0
           AND f.naechste_faelligkeit IS NOT NULL
           AND f.naechste_faelligkeit != ''
           AND COALESCE(f.push_due_sent, 0) = 0
           AND f.naechste_faelligkeit <= ?`
      )
      .bind(today)
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapFaelligkeitRow)
  } catch (error) {
    console.error('Error listFaelligkeitenDueForWebhook:', error)
    return []
  }
}

export async function markFaelligkeitPushSent(
  db: D1Database,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  await db
    .prepare(`UPDATE faelligkeiten SET push_reminder_sent = 1 WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run()
}

export async function markFaelligkeitDueSent(
  db: D1Database,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const placeholders = ids.map(() => '?').join(', ')
  await db
    .prepare(`UPDATE faelligkeiten SET push_due_sent = 1 WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run()
}

export async function listUsersWithWartungPush(db: D1Database): Promise<string[]> {
  try {
    const res = await db
      .prepare(
        `SELECT u.id AS id
         FROM users u
         WHERE u.push_notifications_enabled = 1
           AND COALESCE(u.push_wartung_faellig, 1) != 0
           AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)`
      )
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  } catch {
    // Migration 0042 noch nicht angewendet – alle Push-User
    const res = await db
      .prepare(
        `SELECT u.id AS id
         FROM users u
         WHERE u.push_notifications_enabled = 1
           AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)`
      )
      .all<{ id: string }>()
    return (res.results || []).map((r) => r.id)
  }
}

export interface FaelligkeitVorlage {
  id: string
  name: string
  kategorie: FaelligkeitKategorie
  typ: FaelligkeitTyp
  intervall_einheit: FaelligkeitIntervallEinheit | null
  intervall_wert: number | null
  intervall_rhythmus: FaelligkeitIntervallRhythmus
  warnung_tage_vorher: number
  sicherheitsrelevant: boolean
  quittierung_erforderlich: boolean
  notizen: string | null
  hinweis: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function mapFaelligkeitVorlageRow(row: Record<string, unknown>): FaelligkeitVorlage {
  return {
    id: String(row.id),
    name: String(row.name),
    kategorie: String(row.kategorie) as FaelligkeitKategorie,
    typ: normalizeFaelligkeitTyp(String(row.typ)),
    intervall_einheit:
      row.intervall_einheit != null
        ? (String(row.intervall_einheit) as FaelligkeitIntervallEinheit)
        : null,
    intervall_wert: row.intervall_wert != null ? Number(row.intervall_wert) : null,
    intervall_rhythmus: normalizeIntervallRhythmus(
      row.intervall_rhythmus != null
        ? (String(row.intervall_rhythmus) as FaelligkeitIntervallRhythmus)
        : null
    ),
    warnung_tage_vorher: Number(row.warnung_tage_vorher ?? 30),
    sicherheitsrelevant: !!(row.sicherheitsrelevant ?? 0),
    quittierung_erforderlich: !!(row.quittierung_erforderlich ?? 0),
    notizen: row.notizen != null ? String(row.notizen) : null,
    hinweis: row.hinweis != null ? String(row.hinweis) : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  }
}

export async function getFaelligkeitVorlagen(db: D1Database): Promise<FaelligkeitVorlage[]> {
  try {
    const res = await db
      .prepare(
        `SELECT id, name, kategorie, typ, intervall_einheit, intervall_wert, intervall_rhythmus,
                warnung_tage_vorher, sicherheitsrelevant, quittierung_erforderlich,
                notizen, hinweis, sort_order, created_at, updated_at
         FROM faelligkeit_vorlagen
         ORDER BY sort_order ASC, name COLLATE NOCASE ASC`
      )
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapFaelligkeitVorlageRow)
  } catch (error) {
    console.error('Error getFaelligkeitVorlagen:', error)
    return []
  }
}

export async function getFaelligkeitVorlage(
  db: D1Database,
  id: string
): Promise<FaelligkeitVorlage | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, name, kategorie, typ, intervall_einheit, intervall_wert, intervall_rhythmus,
                warnung_tage_vorher, sicherheitsrelevant, quittierung_erforderlich,
                notizen, hinweis, sort_order, created_at, updated_at
         FROM faelligkeit_vorlagen WHERE id = ?`
      )
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapFaelligkeitVorlageRow(row) : null
  } catch (error) {
    console.error('Error getFaelligkeitVorlage:', error)
    return null
  }
}

async function nextFaelligkeitVorlageSortOrder(db: D1Database): Promise<number> {
  try {
    const row = await db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM faelligkeit_vorlagen')
      .first<{ max_sort: number }>()
    return Number(row?.max_sort ?? 0) + 10
  } catch {
    return 0
  }
}

export async function createFaelligkeitVorlage(
  db: D1Database,
  data: {
    name: string
    kategorie?: FaelligkeitKategorie
    typ: FaelligkeitTyp
    intervall_einheit?: FaelligkeitIntervallEinheit | null
    intervall_wert?: number | null
    intervall_rhythmus?: FaelligkeitIntervallRhythmus | null
    warnung_tage_vorher?: number
    sicherheitsrelevant?: boolean
    quittierung_erforderlich?: boolean
    notizen?: string | null
    hinweis?: string | null
    sort_order?: number
  }
): Promise<FaelligkeitVorlage | null> {
  try {
    const id = crypto.randomUUID()
    const sortOrder =
      data.sort_order !== undefined ? data.sort_order : await nextFaelligkeitVorlageSortOrder(db)
    await db
      .prepare(
        `INSERT INTO faelligkeit_vorlagen (
          id, name, kategorie, typ, intervall_einheit, intervall_wert, intervall_rhythmus,
          warnung_tage_vorher, sicherheitsrelevant, quittierung_erforderlich, notizen, hinweis, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.name.trim(),
        data.kategorie ?? 'sonstiges',
        data.typ,
        data.intervall_einheit ?? null,
        data.intervall_wert ?? null,
        normalizeIntervallRhythmus(data.intervall_rhythmus),
        data.warnung_tage_vorher ?? 30,
        data.sicherheitsrelevant ? 1 : 0,
        data.quittierung_erforderlich ? 1 : 0,
        data.notizen ?? null,
        data.hinweis ?? null,
        sortOrder
      )
      .run()
    return getFaelligkeitVorlage(db, id)
  } catch (error) {
    console.error('Error createFaelligkeitVorlage:', error)
    return null
  }
}

export async function updateFaelligkeitVorlage(
  db: D1Database,
  id: string,
  updates: Partial<{
    name: string
    kategorie: FaelligkeitKategorie
    typ: FaelligkeitTyp
    intervall_einheit: FaelligkeitIntervallEinheit | null
    intervall_wert: number | null
    intervall_rhythmus: FaelligkeitIntervallRhythmus | null
    warnung_tage_vorher: number
    sicherheitsrelevant: boolean
    quittierung_erforderlich: boolean
    notizen: string | null
    hinweis: string | null
    sort_order: number
  }>
): Promise<FaelligkeitVorlage | null> {
  try {
    const existing = await getFaelligkeitVorlage(db, id)
    if (!existing) return null

    const fields: string[] = []
    const values: unknown[] = []
    const set = (col: string, val: unknown) => {
      fields.push(`${col} = ?`)
      values.push(val)
    }

    if (updates.name !== undefined) set('name', updates.name.trim())
    if (updates.kategorie !== undefined) set('kategorie', updates.kategorie)
    if (updates.typ !== undefined) set('typ', updates.typ)
    if (updates.intervall_einheit !== undefined) set('intervall_einheit', updates.intervall_einheit)
    if (updates.intervall_wert !== undefined) set('intervall_wert', updates.intervall_wert)
    if (updates.intervall_rhythmus !== undefined) {
      set('intervall_rhythmus', normalizeIntervallRhythmus(updates.intervall_rhythmus))
    }
    if (updates.warnung_tage_vorher !== undefined) {
      set('warnung_tage_vorher', updates.warnung_tage_vorher)
    }
    if (updates.sicherheitsrelevant !== undefined) {
      set('sicherheitsrelevant', updates.sicherheitsrelevant ? 1 : 0)
    }
    if (updates.quittierung_erforderlich !== undefined) {
      set('quittierung_erforderlich', updates.quittierung_erforderlich ? 1 : 0)
    }
    if (updates.notizen !== undefined) set('notizen', updates.notizen)
    if (updates.hinweis !== undefined) set('hinweis', updates.hinweis)
    if (updates.sort_order !== undefined) set('sort_order', updates.sort_order)

    if (fields.length === 0) return existing
    values.push(id)
    await db
      .prepare(`UPDATE faelligkeit_vorlagen SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
    return getFaelligkeitVorlage(db, id)
  } catch (error) {
    console.error('Error updateFaelligkeitVorlage:', error)
    return null
  }
}

export async function deleteFaelligkeitVorlage(db: D1Database, id: string): Promise<boolean> {
  try {
    const r = await db.prepare('DELETE FROM faelligkeit_vorlagen WHERE id = ?').bind(id).run()
    return r.success && (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error deleteFaelligkeitVorlage:', error)
    return false
  }
}
