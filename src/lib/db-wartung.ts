/**
 * D1 CRUD für Wartung: Fälligkeiten, Historie, Verbrauchsmessungen.
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
import { differenceCalendarDays, normalizeCalendarDate, todayInAppTimezone } from '@/lib/app-timezone'
import { roundDecimals, verbrauchGesamtKg } from '@/lib/verbrauch-format'
import { faelligkeitToHistorieInitial } from '@/lib/faelligkeit-historie-utils'

export type {
  FaelligkeitAmpelStatus,
  FaelligkeitEreignisTyp,
  FaelligkeitIntervallEinheit,
  FaelligkeitIntervallRhythmus,
  FaelligkeitKategorie,
  FaelligkeitTyp,
} from '@/lib/faelligkeit-status'

export type VerbrauchMessungTyp = 'gas' | 'wasser' | 'strom' | 'adblue' | 'sonstiges'

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

export interface VerbrauchMessung {
  id: string
  typ: VerbrauchMessungTyp
  urlaub_id: string | null
  equipment_id: string | null
  transport_id: string | null
  messdatum_start: string | null
  messdatum_ende: string | null
  wert_start: number | null
  wert_ende: number | null
  einheit: string
  verbrauch_gesamt: number | null
  verbrauch_pro_tag: number | null
  notizen: string | null
  created_at: string
  urlaub_titel?: string | null
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

function mapVerbrauchRow(row: Record<string, unknown>): VerbrauchMessung {
  return {
    id: String(row.id),
    typ: String(row.typ) as VerbrauchMessungTyp,
    urlaub_id: row.urlaub_id != null ? String(row.urlaub_id) : null,
    equipment_id: row.equipment_id != null ? String(row.equipment_id) : null,
    transport_id: row.transport_id != null ? String(row.transport_id) : null,
    messdatum_start: row.messdatum_start != null ? String(row.messdatum_start) : null,
    messdatum_ende: row.messdatum_ende != null ? String(row.messdatum_ende) : null,
    wert_start: row.wert_start != null ? Number(row.wert_start) : null,
    wert_ende: row.wert_ende != null ? Number(row.wert_ende) : null,
    einheit: String(row.einheit || 'kg'),
    verbrauch_gesamt: row.verbrauch_gesamt != null ? Number(row.verbrauch_gesamt) : null,
    verbrauch_pro_tag: row.verbrauch_pro_tag != null ? Number(row.verbrauch_pro_tag) : null,
    notizen: row.notizen != null ? String(row.notizen) : null,
    created_at: String(row.created_at || ''),
    urlaub_titel: row.urlaub_titel != null ? String(row.urlaub_titel) : null,
  }
}

function computeVerbrauchValues(
  wertStart: number | null | undefined,
  wertEnde: number | null | undefined,
  messdatumStart: string | null | undefined,
  messdatumEnde: string | null | undefined
): { verbrauch_gesamt: number | null; verbrauch_pro_tag: number | null } {
  if (wertStart == null || wertEnde == null) {
    return { verbrauch_gesamt: null, verbrauch_pro_tag: null }
  }
  const gesamt = verbrauchGesamtKg(wertStart, wertEnde)
  if (!messdatumStart || !messdatumEnde) {
    return { verbrauch_gesamt: gesamt, verbrauch_pro_tag: null }
  }
  const start = normalizeCalendarDate(messdatumStart)
  const end = normalizeCalendarDate(messdatumEnde)
  const days = Math.max(1, differenceCalendarDays(end, start) + 1)
  return {
    verbrauch_gesamt: gesamt,
    verbrauch_pro_tag: roundDecimals(gesamt / days, 2),
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

// --- Verbrauchsmessungen ---

export async function getVerbrauchMessungen(
  db: D1Database,
  options?: { typ?: VerbrauchMessungTyp; urlaubId?: string }
): Promise<VerbrauchMessung[]> {
  try {
    const conditions: string[] = []
    const binds: (string | number)[] = []
    if (options?.typ) {
      conditions.push('v.typ = ?')
      binds.push(options.typ)
    }
    if (options?.urlaubId) {
      conditions.push('v.urlaub_id = ?')
      binds.push(options.urlaubId)
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const res = await db
      .prepare(
        `SELECT v.id, v.typ, v.urlaub_id, v.equipment_id, v.transport_id,
                v.messdatum_start, v.messdatum_ende, v.wert_start, v.wert_ende,
                v.einheit, v.verbrauch_gesamt, v.verbrauch_pro_tag, v.notizen, v.created_at,
                u.titel AS urlaub_titel
         FROM verbrauch_messungen v
         LEFT JOIN urlaube u ON u.id = v.urlaub_id
         ${where}
         ORDER BY v.messdatum_ende DESC, v.created_at DESC`
      )
      .bind(...binds)
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapVerbrauchRow)
  } catch (error) {
    console.error('Error getVerbrauchMessungen:', error)
    return []
  }
}

export async function getVerbrauchMessung(
  db: D1Database,
  id: string
): Promise<VerbrauchMessung | null> {
  try {
    const row = await db
      .prepare(
        `SELECT v.id, v.typ, v.urlaub_id, v.equipment_id, v.transport_id,
                v.messdatum_start, v.messdatum_ende, v.wert_start, v.wert_ende,
                v.einheit, v.verbrauch_gesamt, v.verbrauch_pro_tag, v.notizen, v.created_at,
                u.titel AS urlaub_titel
         FROM verbrauch_messungen v
         LEFT JOIN urlaube u ON u.id = v.urlaub_id
         WHERE v.id = ?`
      )
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapVerbrauchRow(row) : null
  } catch (error) {
    console.error('Error getVerbrauchMessung:', error)
    return null
  }
}

export async function createVerbrauchMessung(
  db: D1Database,
  data: {
    typ?: VerbrauchMessungTyp
    urlaub_id?: string | null
    equipment_id?: string | null
    transport_id?: string | null
    messdatum_start?: string | null
    messdatum_ende?: string | null
    wert_start?: number | null
    wert_ende?: number | null
    einheit?: string
    notizen?: string | null
  }
): Promise<VerbrauchMessung | null> {
  try {
    const id = crypto.randomUUID()
    const { verbrauch_gesamt, verbrauch_pro_tag } = computeVerbrauchValues(
      data.wert_start,
      data.wert_ende,
      data.messdatum_start,
      data.messdatum_ende
    )
    await db
      .prepare(
        `INSERT INTO verbrauch_messungen (
          id, typ, urlaub_id, equipment_id, transport_id,
          messdatum_start, messdatum_ende, wert_start, wert_ende, einheit,
          verbrauch_gesamt, verbrauch_pro_tag, notizen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.typ ?? 'gas',
        data.urlaub_id ?? null,
        data.equipment_id ?? null,
        data.transport_id ?? null,
        data.messdatum_start ? normalizeCalendarDate(data.messdatum_start) : null,
        data.messdatum_ende ? normalizeCalendarDate(data.messdatum_ende) : null,
        data.wert_start ?? null,
        data.wert_ende ?? null,
        data.einheit ?? 'kg',
        verbrauch_gesamt,
        verbrauch_pro_tag,
        data.notizen ?? null
      )
      .run()
    return getVerbrauchMessung(db, id)
  } catch (error) {
    console.error('Error createVerbrauchMessung:', error)
    return null
  }
}

export async function updateVerbrauchMessung(
  db: D1Database,
  id: string,
  updates: Partial<{
    typ: VerbrauchMessungTyp
    urlaub_id: string | null
    equipment_id: string | null
    transport_id: string | null
    messdatum_start: string | null
    messdatum_ende: string | null
    wert_start: number | null
    wert_ende: number | null
    einheit: string
    notizen: string | null
  }>
): Promise<VerbrauchMessung | null> {
  try {
    const existing = await getVerbrauchMessung(db, id)
    if (!existing) return null

    const merged = {
      wert_start: updates.wert_start !== undefined ? updates.wert_start : existing.wert_start,
      wert_ende: updates.wert_ende !== undefined ? updates.wert_ende : existing.wert_ende,
      messdatum_start:
        updates.messdatum_start !== undefined ? updates.messdatum_start : existing.messdatum_start,
      messdatum_ende:
        updates.messdatum_ende !== undefined ? updates.messdatum_ende : existing.messdatum_ende,
    }
    const { verbrauch_gesamt, verbrauch_pro_tag } = computeVerbrauchValues(
      merged.wert_start,
      merged.wert_ende,
      merged.messdatum_start,
      merged.messdatum_ende
    )

    const fields: string[] = []
    const values: (string | number | null)[] = []
    const set = (col: string, val: string | number | null) => {
      fields.push(`${col} = ?`)
      values.push(val)
    }

    if (updates.typ !== undefined) set('typ', updates.typ)
    if (updates.urlaub_id !== undefined) set('urlaub_id', updates.urlaub_id)
    if (updates.equipment_id !== undefined) set('equipment_id', updates.equipment_id)
    if (updates.transport_id !== undefined) set('transport_id', updates.transport_id)
    if (updates.messdatum_start !== undefined) {
      set('messdatum_start', updates.messdatum_start ? normalizeCalendarDate(updates.messdatum_start) : null)
    }
    if (updates.messdatum_ende !== undefined) {
      set('messdatum_ende', updates.messdatum_ende ? normalizeCalendarDate(updates.messdatum_ende) : null)
    }
    if (updates.wert_start !== undefined) set('wert_start', updates.wert_start)
    if (updates.wert_ende !== undefined) set('wert_ende', updates.wert_ende)
    if (updates.einheit !== undefined) set('einheit', updates.einheit)
    if (updates.notizen !== undefined) set('notizen', updates.notizen)

    if (
      updates.wert_start !== undefined ||
      updates.wert_ende !== undefined ||
      updates.messdatum_start !== undefined ||
      updates.messdatum_ende !== undefined
    ) {
      set('verbrauch_gesamt', verbrauch_gesamt)
      set('verbrauch_pro_tag', verbrauch_pro_tag)
    }

    if (fields.length === 0) return existing
    values.push(id)
    await db.prepare(`UPDATE verbrauch_messungen SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    return getVerbrauchMessung(db, id)
  } catch (error) {
    console.error('Error updateVerbrauchMessung:', error)
    return null
  }
}

export async function deleteVerbrauchMessung(db: D1Database, id: string): Promise<boolean> {
  try {
    const r = await db.prepare('DELETE FROM verbrauch_messungen WHERE id = ?').bind(id).run()
    return r.success && (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error deleteVerbrauchMessung:', error)
    return false
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
