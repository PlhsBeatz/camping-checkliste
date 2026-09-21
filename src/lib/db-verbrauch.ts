/**
 * D1 CRUD für Verbrauch: Medien-Konfiguration und Verbrauchsmessungen.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { differenceCalendarDays, normalizeCalendarDate } from '@/lib/app-timezone'
import { roundDecimals, verbrauchDifferenz } from '@/lib/verbrauch-format'
import {
  getKatalogEintrag,
  type VerbrauchMessmodus,
} from '@/lib/verbrauch-medien-katalog'

/** Medien-Schlüssel (Katalog oder custom_…). */
export type VerbrauchMessungTyp = string

export interface VerbrauchMedium {
  id: string
  schluessel: string
  name: string
  einheit: string
  messmodus: VerbrauchMessmodus
  label_wert_start: string
  label_wert_ende: string
  dichte_kg_pro_l: number | null
  leergewicht_kg: number | null
  ist_aktiv: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface VerbrauchEreignis {
  id: string
  messung_id: string
  typ: 'auffuellung'
  datum: string | null
  menge: number
  notizen: string | null
  created_at: string
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
  ereignisse?: VerbrauchEreignis[]
  auffuellungen_summe?: number
}

function normalizeMessmodus(value: string | null | undefined): VerbrauchMessmodus {
  return value === 'zunahme' ? 'zunahme' : 'abnahme'
}

function mapEreignisRow(row: Record<string, unknown>): VerbrauchEreignis {
  return {
    id: String(row.id),
    messung_id: String(row.messung_id),
    typ: 'auffuellung',
    datum: row.datum != null ? String(row.datum) : null,
    menge: Number(row.menge),
    notizen: row.notizen != null ? String(row.notizen) : null,
    created_at: String(row.created_at || ''),
  }
}

function mapMediumRow(row: Record<string, unknown>): VerbrauchMedium {
  return {
    id: String(row.id),
    schluessel: String(row.schluessel),
    name: String(row.name),
    einheit: String(row.einheit || 'kg'),
    messmodus: normalizeMessmodus(row.messmodus != null ? String(row.messmodus) : null),
    label_wert_start: String(row.label_wert_start || 'Anfang'),
    label_wert_ende: String(row.label_wert_ende || 'Ende'),
    dichte_kg_pro_l: row.dichte_kg_pro_l != null ? Number(row.dichte_kg_pro_l) : null,
    leergewicht_kg: row.leergewicht_kg != null ? Number(row.leergewicht_kg) : null,
    ist_aktiv: !!(row.ist_aktiv ?? 1),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  }
}

function mapVerbrauchRow(row: Record<string, unknown>): VerbrauchMessung {
  return {
    id: String(row.id),
    typ: String(row.typ),
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

function sumAuffuellungen(ereignisse: VerbrauchEreignis[]): number {
  return roundDecimals(
    ereignisse.reduce((acc, e) => acc + (Number.isFinite(e.menge) ? e.menge : 0), 0),
    1
  )
}

function computeVerbrauchValues(
  wertStart: number | null | undefined,
  wertEnde: number | null | undefined,
  messdatumStart: string | null | undefined,
  messdatumEnde: string | null | undefined,
  messmodus: VerbrauchMessmodus = 'abnahme',
  auffuellungenSumme = 0
): { verbrauch_gesamt: number | null; verbrauch_pro_tag: number | null } {
  if (wertStart == null || wertEnde == null) {
    return { verbrauch_gesamt: null, verbrauch_pro_tag: null }
  }
  const gesamt = verbrauchDifferenz(wertStart, wertEnde, messmodus, auffuellungenSumme)
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

const MEDIUM_SELECT = `
  SELECT id, schluessel, name, einheit, messmodus,
         label_wert_start, label_wert_ende, dichte_kg_pro_l, leergewicht_kg,
         ist_aktiv, sort_order, created_at, updated_at
  FROM verbrauch_medien
`

// --- Medien ---

export async function getVerbrauchMedien(
  db: D1Database,
  options?: { onlyActive?: boolean }
): Promise<VerbrauchMedium[]> {
  try {
    const where = options?.onlyActive ? 'WHERE ist_aktiv = 1' : ''
    const res = await db
      .prepare(`${MEDIUM_SELECT} ${where} ORDER BY sort_order ASC, name ASC`)
      .all<Record<string, unknown>>()
    return (res.results || []).map(mapMediumRow)
  } catch (error) {
    console.error('Error getVerbrauchMedien:', error)
    return []
  }
}

export async function getVerbrauchMedium(
  db: D1Database,
  id: string
): Promise<VerbrauchMedium | null> {
  try {
    const row = await db
      .prepare(`${MEDIUM_SELECT} WHERE id = ?`)
      .bind(id)
      .first<Record<string, unknown>>()
    return row ? mapMediumRow(row) : null
  } catch (error) {
    console.error('Error getVerbrauchMedium:', error)
    return null
  }
}

export async function getVerbrauchMediumBySchluessel(
  db: D1Database,
  schluessel: string
): Promise<VerbrauchMedium | null> {
  try {
    const row = await db
      .prepare(`${MEDIUM_SELECT} WHERE schluessel = ?`)
      .bind(schluessel)
      .first<Record<string, unknown>>()
    return row ? mapMediumRow(row) : null
  } catch (error) {
    console.error('Error getVerbrauchMediumBySchluessel:', error)
    return null
  }
}

export async function activateVerbrauchMediumFromKatalog(
  db: D1Database,
  schluessel: string
): Promise<VerbrauchMedium | null> {
  const katalog = getKatalogEintrag(schluessel)
  if (!katalog) return null

  try {
    const existing = await getVerbrauchMediumBySchluessel(db, schluessel)
    if (existing) {
      if (!existing.ist_aktiv) {
        await db
          .prepare('UPDATE verbrauch_medien SET ist_aktiv = 1 WHERE id = ?')
          .bind(existing.id)
          .run()
        return getVerbrauchMedium(db, existing.id)
      }
      return existing
    }

    const id = schluessel
    await db
      .prepare(
        `INSERT INTO verbrauch_medien (
          id, schluessel, name, einheit, messmodus,
          label_wert_start, label_wert_ende, dichte_kg_pro_l, leergewicht_kg,
          ist_aktiv, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .bind(
        id,
        katalog.schluessel,
        katalog.name,
        katalog.einheit,
        katalog.messmodus,
        katalog.label_wert_start,
        katalog.label_wert_ende,
        katalog.dichte_kg_pro_l ?? null,
        katalog.leergewicht_kg ?? null,
        katalog.sort_order
      )
      .run()
    return getVerbrauchMedium(db, id)
  } catch (error) {
    console.error('Error activateVerbrauchMediumFromKatalog:', error)
    return null
  }
}

export async function createCustomVerbrauchMedium(
  db: D1Database,
  data: {
    name: string
    einheit: string
    messmodus?: VerbrauchMessmodus
    label_wert_start?: string
    label_wert_ende?: string
    sort_order?: number
    dichte_kg_pro_l?: number | null
    leergewicht_kg?: number | null
  }
): Promise<VerbrauchMedium | null> {
  try {
    const id = crypto.randomUUID()
    const schluessel = `custom_${id.replace(/-/g, '').slice(0, 12)}`
    const messmodus = data.messmodus === 'zunahme' ? 'zunahme' : 'abnahme'
    const labelStart =
      data.label_wert_start?.trim() ||
      (messmodus === 'zunahme' ? 'Zählerstand Anfang' : 'Stand Anfang')
    const labelEnde =
      data.label_wert_ende?.trim() ||
      (messmodus === 'zunahme' ? 'Zählerstand Ende' : 'Stand Ende')
    const sortOrder = data.sort_order ?? 100

    await db
      .prepare(
        `INSERT INTO verbrauch_medien (
          id, schluessel, name, einheit, messmodus,
          label_wert_start, label_wert_ende, dichte_kg_pro_l, leergewicht_kg,
          ist_aktiv, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      )
      .bind(
        id,
        schluessel,
        data.name.trim(),
        data.einheit.trim() || 'kg',
        messmodus,
        labelStart,
        labelEnde,
        data.dichte_kg_pro_l ?? null,
        data.leergewicht_kg ?? null,
        sortOrder
      )
      .run()
    return getVerbrauchMedium(db, id)
  } catch (error) {
    console.error('Error createCustomVerbrauchMedium:', error)
    return null
  }
}

export async function updateVerbrauchMedium(
  db: D1Database,
  id: string,
  updates: Partial<{
    name: string
    einheit: string
    messmodus: VerbrauchMessmodus
    label_wert_start: string
    label_wert_ende: string
    dichte_kg_pro_l: number | null
    leergewicht_kg: number | null
    ist_aktiv: boolean
    sort_order: number
  }>
): Promise<VerbrauchMedium | null> {
  try {
    const existing = await getVerbrauchMedium(db, id)
    if (!existing) return null

    const fields: string[] = []
    const values: (string | number | null)[] = []
    const set = (col: string, val: string | number | null) => {
      fields.push(`${col} = ?`)
      values.push(val)
    }

    if (updates.name !== undefined) set('name', updates.name.trim())
    if (updates.einheit !== undefined) set('einheit', updates.einheit.trim() || 'kg')
    if (updates.messmodus !== undefined) {
      set('messmodus', updates.messmodus === 'zunahme' ? 'zunahme' : 'abnahme')
    }
    if (updates.label_wert_start !== undefined) set('label_wert_start', updates.label_wert_start.trim())
    if (updates.label_wert_ende !== undefined) set('label_wert_ende', updates.label_wert_ende.trim())
    if (updates.dichte_kg_pro_l !== undefined) set('dichte_kg_pro_l', updates.dichte_kg_pro_l)
    if (updates.leergewicht_kg !== undefined) set('leergewicht_kg', updates.leergewicht_kg)
    if (updates.ist_aktiv !== undefined) set('ist_aktiv', updates.ist_aktiv ? 1 : 0)
    if (updates.sort_order !== undefined) set('sort_order', updates.sort_order)

    if (fields.length === 0) return existing
    values.push(id)
    await db
      .prepare(`UPDATE verbrauch_medien SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
    return getVerbrauchMedium(db, id)
  } catch (error) {
    console.error('Error updateVerbrauchMedium:', error)
    return null
  }
}

export async function deleteVerbrauchMedium(db: D1Database, id: string): Promise<boolean> {
  try {
    const medium = await getVerbrauchMedium(db, id)
    if (!medium) return false
    const r = await db.prepare('DELETE FROM verbrauch_medien WHERE id = ?').bind(id).run()
    return r.success && (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error deleteVerbrauchMedium:', error)
    return false
  }
}

// --- Messungen ---

async function getEreignisseForMessungIds(
  db: D1Database,
  messungIds: string[]
): Promise<Map<string, VerbrauchEreignis[]>> {
  const map = new Map<string, VerbrauchEreignis[]>()
  if (messungIds.length === 0) return map
  try {
    const placeholders = messungIds.map(() => '?').join(',')
    const res = await db
      .prepare(
        `SELECT id, messung_id, typ, datum, menge, notizen, created_at
         FROM verbrauch_ereignisse
         WHERE messung_id IN (${placeholders})
         ORDER BY COALESCE(datum, created_at) ASC, created_at ASC`
      )
      .bind(...messungIds)
      .all<Record<string, unknown>>()
    for (const row of res.results || []) {
      const e = mapEreignisRow(row)
      const list = map.get(e.messung_id) ?? []
      list.push(e)
      map.set(e.messung_id, list)
    }
  } catch (error) {
    console.error('Error getEreignisseForMessungIds:', error)
  }
  return map
}

function attachEreignisse(
  messungen: VerbrauchMessung[],
  byMessung: Map<string, VerbrauchEreignis[]>
): VerbrauchMessung[] {
  return messungen.map((m) => {
    const ereignisse = byMessung.get(m.id) ?? []
    return {
      ...m,
      ereignisse,
      auffuellungen_summe: sumAuffuellungen(ereignisse),
    }
  })
}

async function recalculateMessungVerbrauch(
  db: D1Database,
  messungId: string
): Promise<VerbrauchMessung | null> {
  const existing = await getVerbrauchMessung(db, messungId)
  if (!existing) return null
  const messmodus = await resolveMessmodusForTyp(db, existing.typ)
  const auffuellungen = existing.auffuellungen_summe ?? 0
  const { verbrauch_gesamt, verbrauch_pro_tag } = computeVerbrauchValues(
    existing.wert_start,
    existing.wert_ende,
    existing.messdatum_start,
    existing.messdatum_ende,
    messmodus,
    messmodus === 'abnahme' ? auffuellungen : 0
  )
  await db
    .prepare(
      `UPDATE verbrauch_messungen
       SET verbrauch_gesamt = ?, verbrauch_pro_tag = ?
       WHERE id = ?`
    )
    .bind(verbrauch_gesamt, verbrauch_pro_tag, messungId)
    .run()
  return getVerbrauchMessung(db, messungId)
}

export async function getVerbrauchMessungen(
  db: D1Database,
  options?: {
    typ?: VerbrauchMessungTyp
    urlaubId?: string
    /** Standard true; Attention/Reichweite braucht keine Auffüllungs-Events. */
    withEreignisse?: boolean
  }
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
    const items = (res.results || []).map(mapVerbrauchRow)
    if (options?.withEreignisse === false) return items
    const byMessung = await getEreignisseForMessungIds(
      db,
      items.map((i) => i.id)
    )
    return attachEreignisse(items, byMessung)
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
    if (!row) return null
    const item = mapVerbrauchRow(row)
    const byMessung = await getEreignisseForMessungIds(db, [id])
    return attachEreignisse([item], byMessung)[0] ?? item
  } catch (error) {
    console.error('Error getVerbrauchMessung:', error)
    return null
  }
}

async function resolveMessmodusForTyp(
  db: D1Database,
  typ: string
): Promise<VerbrauchMessmodus> {
  const medium = await getVerbrauchMediumBySchluessel(db, typ)
  if (medium) return medium.messmodus
  const katalog = getKatalogEintrag(typ)
  return katalog?.messmodus ?? 'abnahme'
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
    const typ = data.typ ?? 'gas'
    const medium = await getVerbrauchMediumBySchluessel(db, typ)
    if (!medium || !medium.ist_aktiv) {
      console.error('createVerbrauchMessung: Medium nicht aktiv:', typ)
      return null
    }

    const id = crypto.randomUUID()
    const { verbrauch_gesamt, verbrauch_pro_tag } = computeVerbrauchValues(
      data.wert_start,
      data.wert_ende,
      data.messdatum_start,
      data.messdatum_ende,
      medium.messmodus,
      0
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
        typ,
        data.urlaub_id ?? null,
        data.equipment_id ?? null,
        data.transport_id ?? null,
        data.messdatum_start ? normalizeCalendarDate(data.messdatum_start) : null,
        data.messdatum_ende ? normalizeCalendarDate(data.messdatum_ende) : null,
        data.wert_start ?? null,
        data.wert_ende ?? null,
        data.einheit ?? medium.einheit,
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

    const typ = updates.typ !== undefined ? updates.typ : existing.typ
    if (updates.typ !== undefined) {
      const medium = await getVerbrauchMediumBySchluessel(db, typ)
      if (!medium || !medium.ist_aktiv) {
        console.error('updateVerbrauchMessung: Medium nicht aktiv:', typ)
        return null
      }
    }

    const merged = {
      wert_start: updates.wert_start !== undefined ? updates.wert_start : existing.wert_start,
      wert_ende: updates.wert_ende !== undefined ? updates.wert_ende : existing.wert_ende,
      messdatum_start:
        updates.messdatum_start !== undefined ? updates.messdatum_start : existing.messdatum_start,
      messdatum_ende:
        updates.messdatum_ende !== undefined ? updates.messdatum_ende : existing.messdatum_ende,
    }
    const messmodus = await resolveMessmodusForTyp(db, typ)
    const auffuellungen =
      messmodus === 'abnahme' ? (existing.auffuellungen_summe ?? 0) : 0
    const { verbrauch_gesamt, verbrauch_pro_tag } = computeVerbrauchValues(
      merged.wert_start,
      merged.wert_ende,
      merged.messdatum_start,
      merged.messdatum_ende,
      messmodus,
      auffuellungen
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
      updates.messdatum_ende !== undefined ||
      updates.typ !== undefined
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

// --- Ereignisse (Auffüllungen) ---

export async function createVerbrauchEreignis(
  db: D1Database,
  data: {
    messung_id: string
    menge: number
    datum?: string | null
    notizen?: string | null
  }
): Promise<VerbrauchEreignis | null> {
  try {
    const messung = await getVerbrauchMessung(db, data.messung_id)
    if (!messung) return null
    if (!(data.menge > 0)) return null

    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO verbrauch_ereignisse (id, messung_id, typ, datum, menge, notizen)
         VALUES (?, ?, 'auffuellung', ?, ?, ?)`
      )
      .bind(
        id,
        data.messung_id,
        data.datum ? normalizeCalendarDate(data.datum) : null,
        data.menge,
        data.notizen ?? null
      )
      .run()
    await recalculateMessungVerbrauch(db, data.messung_id)

    const byMessung = await getEreignisseForMessungIds(db, [data.messung_id])
    return (byMessung.get(data.messung_id) ?? []).find((e) => e.id === id) ?? null
  } catch (error) {
    console.error('Error createVerbrauchEreignis:', error)
    return null
  }
}

export async function updateVerbrauchEreignis(
  db: D1Database,
  id: string,
  updates: Partial<{
    menge: number
    datum: string | null
    notizen: string | null
  }>
): Promise<VerbrauchEreignis | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, messung_id, typ, datum, menge, notizen, created_at
         FROM verbrauch_ereignisse WHERE id = ?`
      )
      .bind(id)
      .first<Record<string, unknown>>()
    if (!row) return null
    const existing = mapEreignisRow(row)

    const fields: string[] = []
    const values: (string | number | null)[] = []
    const set = (col: string, val: string | number | null) => {
      fields.push(`${col} = ?`)
      values.push(val)
    }
    if (updates.menge !== undefined) {
      if (!(updates.menge > 0)) return null
      set('menge', updates.menge)
    }
    if (updates.datum !== undefined) {
      set('datum', updates.datum ? normalizeCalendarDate(updates.datum) : null)
    }
    if (updates.notizen !== undefined) set('notizen', updates.notizen)

    if (fields.length > 0) {
      values.push(id)
      await db
        .prepare(`UPDATE verbrauch_ereignisse SET ${fields.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run()
    }
    await recalculateMessungVerbrauch(db, existing.messung_id)
    const byMessung = await getEreignisseForMessungIds(db, [existing.messung_id])
    return (byMessung.get(existing.messung_id) ?? []).find((e) => e.id === id) ?? null
  } catch (error) {
    console.error('Error updateVerbrauchEreignis:', error)
    return null
  }
}

export async function deleteVerbrauchEreignis(db: D1Database, id: string): Promise<boolean> {
  try {
    const row = await db
      .prepare('SELECT messung_id FROM verbrauch_ereignisse WHERE id = ?')
      .bind(id)
      .first<{ messung_id: string }>()
    if (!row) return false
    const r = await db.prepare('DELETE FROM verbrauch_ereignisse WHERE id = ?').bind(id).run()
    const ok = r.success && (r.meta?.changes ?? 0) > 0
    if (ok) await recalculateMessungVerbrauch(db, row.messung_id)
    return ok
  } catch (error) {
    console.error('Error deleteVerbrauchEreignis:', error)
    return false
  }
}

// --- Medium ↔ Ausrüstung (Relevanz) ---

export type VerbrauchMediumAusruestungLink = {
  medium_id: string
  equipment_id: string
  was: string
  status: string
}

export async function getVerbrauchMedienAusruestungLinks(
  db: D1Database,
  mediumId?: string
): Promise<VerbrauchMediumAusruestungLink[]> {
  try {
    const where = mediumId ? 'WHERE vma.medium_id = ?' : ''
    const binds = mediumId ? [mediumId] : []
    const res = await db
      .prepare(
        `SELECT vma.medium_id, vma.equipment_id, ag.was, ag.status
         FROM verbrauch_medien_ausruestung vma
         JOIN ausruestungsgegenstaende ag ON ag.id = vma.equipment_id
         ${where}
         ORDER BY ag.was COLLATE NOCASE ASC`
      )
      .bind(...binds)
      .all<Record<string, unknown>>()
    return (res.results || []).map((row) => ({
      medium_id: String(row.medium_id),
      equipment_id: String(row.equipment_id),
      was: String(row.was ?? ''),
      status: String(row.status ?? 'Normal'),
    }))
  } catch (error) {
    console.error('Error getVerbrauchMedienAusruestungLinks:', error)
    return []
  }
}

export async function setVerbrauchMediumAusruestung(
  db: D1Database,
  mediumId: string,
  equipmentIds: string[]
): Promise<VerbrauchMediumAusruestungLink[]> {
  const medium = await getVerbrauchMedium(db, mediumId)
  if (!medium) return []

  const unique = [...new Set(equipmentIds.map((id) => id.trim()).filter(Boolean))]

  try {
    const statements = [
      db
        .prepare('DELETE FROM verbrauch_medien_ausruestung WHERE medium_id = ?')
        .bind(mediumId),
      ...unique.map((equipmentId) =>
        db
          .prepare(
            `INSERT INTO verbrauch_medien_ausruestung (medium_id, equipment_id)
             VALUES (?, ?)`
          )
          .bind(mediumId, equipmentId)
      ),
    ]
    await db.batch(statements)
  } catch (error) {
    console.error('Error setVerbrauchMediumAusruestung:', error)
  }

  return getVerbrauchMedienAusruestungLinks(db, mediumId)
}
