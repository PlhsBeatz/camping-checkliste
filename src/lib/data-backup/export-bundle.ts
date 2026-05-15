/**
 * Backup-Bundle aus D1 zusammenbauen (Admin-Export).
 */
import type { D1Database } from '@cloudflare/workers-types'

import type { BackupBundle, BackupTableData, ExportOptions } from './types'
import { BACKUP_FORMAT_VERSION } from './types'
import {
  AUTH_TABLES,
  BACKUP_TABLE_ORDER,
  mergePresetTables,
  rowKey,
  domainLabelsForPresets,
  topologicalTableList,
} from './tables'

const VACATION_TABLES = new Set([
  'urlaube',
  'urlaub_mitreisende',
  'urlaub_campingplaetze',
  'packlisten',
  'packlisten_eintraege',
  'packlisten_eintrag_mitreisende',
  'packlisten_eintraege_temporaer',
  'packlisten_eintrag_mitreisende_temporaer',
])

function placeholders(n: number): string {
  return n > 0 ? Array(n).fill('?').join(',') : ''
}

async function tableExists(db: D1Database, table: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .bind(table)
    .first<{ name: string }>()
  return Boolean(row?.name)
}

async function selectAllSafe(
  db: D1Database,
  table: string
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  if (!BACKUP_TABLE_ORDER.includes(table)) {
    return { rows: [], error: 'Unbekannte Tabelle' }
  }
  try {
    if (!(await tableExists(db, table))) return { rows: [] }
    const r = await db.prepare(`SELECT * FROM ${table}`).all()
    return { rows: (r.results ?? []) as Record<string, unknown>[] }
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) }
  }
}

function mergeRows(table: string, ...batches: Record<string, unknown>[][]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()
  for (const batch of batches) {
    for (const row of batch) map.set(rowKey(table, row), row)
  }
  return [...map.values()]
}

/** Urlaubs-Subset inkl. referenzierter Ausrüstung / Struktur / Camping */
async function vacationClosureExports(
  db: D1Database,
  vacationIds: string[],
  warnings: string[]
): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {}
  if (vacationIds.length === 0) return out
  const iv = placeholders(vacationIds.length)
  const bindVac = [...vacationIds]

  try {
    const urlaubeR = await db.prepare(`SELECT * FROM urlaube WHERE id IN (${iv})`).bind(...bindVac).all()
    out.urlaube = (urlaubeR.results ?? []) as Record<string, unknown>[]

    const umR = await db
      .prepare(`SELECT * FROM urlaub_mitreisende WHERE urlaub_id IN (${iv})`)
      .bind(...bindVac)
      .all()
    out.urlaub_mitreisende = (umR.results ?? []) as Record<string, unknown>[]

    const plR = await db
      .prepare(`SELECT * FROM packlisten WHERE urlaub_id IN (${iv})`)
      .bind(...bindVac)
      .all()
    out.packlisten = (plR.results ?? []) as Record<string, unknown>[]
  } catch (e) {
    warnings.push(`vacationClosure Kern: ${e instanceof Error ? e.message : String(e)}`)
    return out
  }

  const packlisteIds = [...new Set(out.packlisten?.map((p) => String(p.id)).filter(Boolean) ?? [])]
  const ucEarly = await db
    .prepare(`SELECT * FROM urlaub_campingplaetze WHERE urlaub_id IN (${iv})`)
    .bind(...bindVac)
    .all()
  out.urlaub_campingplaetze = (ucEarly.results ?? []) as Record<string, unknown>[]

  if (packlisteIds.length === 0) {
    out.packlisten_eintraege = []
    out.packlisten_eintrag_mitreisende = []
    out.packlisten_eintraege_temporaer = []
    out.packlisten_eintrag_mitreisende_temporaer = []
    return out
  }

  const ip = placeholders(packlisteIds.length)
  try {
    const peR = await db
      .prepare(`SELECT * FROM packlisten_eintraege WHERE packliste_id IN (${ip})`)
      .bind(...packlisteIds)
      .all()
    out.packlisten_eintraege = (peR.results ?? []) as Record<string, unknown>[]

    const petR = await db
      .prepare(`SELECT * FROM packlisten_eintraege_temporaer WHERE packliste_id IN (${ip})`)
      .bind(...packlisteIds)
      .all()
    out.packlisten_eintraege_temporaer = (petR.results ?? []) as Record<string, unknown>[]

    const entryIds = out.packlisten_eintraege.map((e) => String(e.id)).filter(Boolean)
    if (entryIds.length > 0) {
      const ie = placeholders(entryIds.length)
      const pmR = await db
        .prepare(`SELECT * FROM packlisten_eintrag_mitreisende WHERE packlisten_eintrag_id IN (${ie})`)
        .bind(...entryIds)
        .all()
      out.packlisten_eintrag_mitreisende = (pmR.results ?? []) as Record<string, unknown>[]
    } else out.packlisten_eintrag_mitreisende = []

    const tempEntryIds = out.packlisten_eintraege_temporaer.map((e) => String(e.id)).filter(Boolean)
    if (tempEntryIds.length > 0) {
      const ite = placeholders(tempEntryIds.length)
      const pmtR = await db
        .prepare(`SELECT * FROM packlisten_eintrag_mitreisende_temporaer WHERE packlisten_eintrag_id IN (${ite})`)
        .bind(...tempEntryIds)
        .all()
      out.packlisten_eintrag_mitreisende_temporaer = (pmtR.results ?? []) as Record<string, unknown>[]
    } else out.packlisten_eintrag_mitreisende_temporaer = []

    const mitreisendeIds = new Set<string>()
    for (const r of out.urlaub_mitreisende) {
      const id = r.mitreisender_id as string | undefined
      if (id) mitreisendeIds.add(id)
    }
    for (const r of out.packlisten_eintrag_mitreisende ?? []) {
      const id = r.mitreisender_id as string | undefined
      if (id) mitreisendeIds.add(id)
    }
    for (const r of out.packlisten_eintrag_mitreisende_temporaer ?? []) {
      const id = r.mitreisender_id as string | undefined
      if (id) mitreisendeIds.add(id)
    }

    const gegenstandIds = [
      ...new Set(out.packlisten_eintraege.map((e) => String(e.gegenstand_id)).filter(Boolean)),
    ]

    let mitreisendeRows: Record<string, unknown>[] = []
    let berechtigungRows: Record<string, unknown>[] = []
    if (mitreisendeIds.size > 0) {
      const im = placeholders(mitreisendeIds.size)
      const mids = [...mitreisendeIds]
      const mR = await db.prepare(`SELECT * FROM mitreisende WHERE id IN (${im})`).bind(...mids).all()
      mitreisendeRows = (mR.results ?? []) as Record<string, unknown>[]
      const mbR = await db
        .prepare(`SELECT * FROM mitreisende_berechtigungen WHERE mitreisender_id IN (${im})`)
        .bind(...mids)
        .all()
      berechtigungRows = (mbR.results ?? []) as Record<string, unknown>[]
    }

    let equipRows: Record<string, unknown>[] = []
    let linkRows: Record<string, unknown>[] = []
    let stdMitRows: Record<string, unknown>[] = []
    let tagRows: Record<string, unknown>[] = []
    let katRows: Record<string, unknown>[] = []
    let hkRows: Record<string, unknown>[] = []
    let transportRows: Record<string, unknown>[] = []
    let festgewRows: Record<string, unknown>[] = []
    let tagDefRows: Record<string, unknown>[] = []
    let tagKatRows: Record<string, unknown>[] = []

    const transportIds = new Set<string>()

    if (gegenstandIds.length > 0) {
      const ig = placeholders(gegenstandIds.length)
      const agR = await db.prepare(`SELECT * FROM ausruestungsgegenstaende WHERE id IN (${ig})`).bind(...gegenstandIds).all()
      equipRows = (agR.results ?? []) as Record<string, unknown>[]
      const linkR = await db
        .prepare(`SELECT * FROM ausruestungsgegenstaende_links WHERE gegenstand_id IN (${ig})`)
        .bind(...gegenstandIds)
        .all()
      linkRows = (linkR.results ?? []) as Record<string, unknown>[]
      const stdR = await db
        .prepare(`SELECT * FROM ausruestungsgegenstaende_standard_mitreisende WHERE gegenstand_id IN (${ig})`)
        .bind(...gegenstandIds)
        .all()
      stdMitRows = (stdR.results ?? []) as Record<string, unknown>[]
      const tjR = await db
        .prepare(`SELECT * FROM ausruestungsgegenstaende_tags WHERE gegenstand_id IN (${ig})`)
        .bind(...gegenstandIds)
        .all()
      tagRows = (tjR.results ?? []) as Record<string, unknown>[]

      const kategorieIds = new Set<string>()
      for (const row of equipRows) {
        const k = row.kategorie_id as string | undefined
        if (k) kategorieIds.add(k)
        const t = row.transport_id as string | null | undefined
        if (t) transportIds.add(t)
      }

      if (kategorieIds.size > 0) {
        const ik = placeholders(kategorieIds.size)
        const kids = [...kategorieIds]
        const kR = await db.prepare(`SELECT * FROM kategorien WHERE id IN (${ik})`).bind(...kids).all()
        katRows = (kR.results ?? []) as Record<string, unknown>[]
        const hkIds = new Set<string>()
        for (const k of katRows) {
          const hk = k.hauptkategorie_id as string | undefined
          if (hk) hkIds.add(hk)
          const pt = k.pauschal_transport_id as string | null | undefined
          if (typeof pt === 'string' && pt) transportIds.add(pt)
        }
        if (hkIds.size > 0) {
          const ihk = placeholders(hkIds.size)
          const hR = await db
            .prepare(`SELECT * FROM hauptkategorien WHERE id IN (${ihk})`)
            .bind(...[...hkIds])
            .all()
          hkRows = (hR.results ?? []) as Record<string, unknown>[]
          for (const hk of hkRows) {
            const pt = hk.pauschal_transport_id as string | null | undefined
            if (typeof pt === 'string' && pt) transportIds.add(pt)
          }
        }
      }

      const tagDefIds = new Set<string>()
      for (const tr of tagRows) {
        const tid = tr.tag_id as string | undefined
        if (tid) tagDefIds.add(tid)
      }
      if (tagDefIds.size > 0) {
        const it = placeholders(tagDefIds.size)
        const tdefs = [...tagDefIds]
        const tagsR = await db.prepare(`SELECT * FROM tags WHERE id IN (${it})`).bind(...tdefs).all()
        tagDefRows = (tagsR.results ?? []) as Record<string, unknown>[]
        const catIds = new Set<string>()
        for (const tg of tagDefRows) {
          const c = tg.tag_kategorie_id as string | undefined
          if (c) catIds.add(c)
        }
        if (catIds.size > 0) {
          const ick = placeholders(catIds.size)
          const tkR = await db
            .prepare(`SELECT * FROM tag_kategorien WHERE id IN (${ick})`)
            .bind(...[...catIds])
            .all()
          tagKatRows = (tkR.results ?? []) as Record<string, unknown>[]
        }
      }

      for (const sm of stdMitRows) {
        const mid = sm.mitreisender_id as string | undefined
        if (mid) mitreisendeIds.add(mid)
      }
      if (mitreisendeIds.size > mitreisendeRows.length || mitreisendeRows.length === 0) {
        const im2 = placeholders(mitreisendeIds.size)
        const mids2 = [...mitreisendeIds]
        const mR2 = await db.prepare(`SELECT * FROM mitreisende WHERE id IN (${im2})`).bind(...mids2).all()
        mitreisendeRows = (mR2.results ?? []) as Record<string, unknown>[]
        const mbR2 = await db
          .prepare(`SELECT * FROM mitreisende_berechtigungen WHERE mitreisender_id IN (${im2})`)
          .bind(...mids2)
          .all()
        berechtigungRows = (mbR2.results ?? []) as Record<string, unknown>[]
      }
    }

    if (transportIds.size > 0) {
      const it = placeholders(transportIds.size)
      const tidl = [...transportIds]
      const tR = await db.prepare(`SELECT * FROM transportmittel WHERE id IN (${it})`).bind(...tidl).all()
      transportRows = (tR.results ?? []) as Record<string, unknown>[]
      const tfR = await db
        .prepare(`SELECT * FROM transportmittel_festgewicht_manuell WHERE transport_id IN (${it})`)
        .bind(...tidl)
        .all()
      festgewRows = (tfR.results ?? []) as Record<string, unknown>[]
    }

    const campingIds = [...new Set(out.urlaub_campingplaetze.map((r) => String(r.campingplatz_id)).filter(Boolean))]
    let campRows: Record<string, unknown>[] = []
    let fotoRows: Record<string, unknown>[] = []
    if (campingIds.length > 0) {
      const ic = placeholders(campingIds.length)
      const cR = await db.prepare(`SELECT * FROM campingplaetze WHERE id IN (${ic})`).bind(...campingIds).all()
      campRows = (cR.results ?? []) as Record<string, unknown>[]
      const cfR = await db
        .prepare(`SELECT * FROM campingplatz_fotos WHERE campingplatz_id IN (${ic})`)
        .bind(...campingIds)
        .all()
      fotoRows = (cfR.results ?? []) as Record<string, unknown>[]
    }

    out.mitreisende = mitreisendeRows
    out.mitreisende_berechtigungen = berechtigungRows
    out.ausruestungsgegenstaende = equipRows
    out.ausruestungsgegenstaende_links = linkRows
    out.ausruestungsgegenstaende_standard_mitreisende = stdMitRows
    out.ausruestungsgegenstaende_tags = tagRows
    out.kategorien = katRows
    out.hauptkategorien = hkRows
    out.transportmittel = transportRows
    out.transportmittel_festgewicht_manuell = festgewRows
    out.tags = tagDefRows
    out.tag_kategorien = tagKatRows
    out.campingplaetze = campRows
    out.campingplatz_fotos = fotoRows

    if (out.packlisten.length > 0 && gegenstandIds.length === 0) {
      warnings.push(
        'Urlaubs-Export (Closure): keine Ausrüstungs-IDs in Packlistenzeilen — Referenz-Kern ohne Ausrüstung.'
      )
    }
  } catch (e) {
    warnings.push(`vacationClosure: ${e instanceof Error ? e.message : String(e)}`)
  }

  return out
}

/** Nur Urlaubs-Tabellen gefiltert, ohne Closure */
async function filteredVacationTables(
  db: D1Database,
  vacationIds: string[],
  warnings: string[]
): Promise<Record<string, Record<string, unknown>[]>> {
  const iv = placeholders(vacationIds.length)
  const bindVac = [...vacationIds]
  const out: Record<string, Record<string, unknown>[]> = {}
  const tryQ = async (table: string, sql: string, bind: unknown[]) => {
    try {
      if (!(await tableExists(db, table))) {
        out[table] = []
        return
      }
      const r = await db.prepare(sql).bind(...bind).all()
      out[table] = (r.results ?? []) as Record<string, unknown>[]
    } catch (e) {
      warnings.push(`${table}: ${e instanceof Error ? e.message : String(e)}`)
      out[table] = []
    }
  }

  await tryQ('urlaube', `SELECT * FROM urlaube WHERE id IN (${iv})`, bindVac)
  await tryQ('urlaub_mitreisende', `SELECT * FROM urlaub_mitreisende WHERE urlaub_id IN (${iv})`, bindVac)
  await tryQ('urlaub_campingplaetze', `SELECT * FROM urlaub_campingplaetze WHERE urlaub_id IN (${iv})`, bindVac)
  await tryQ('packlisten', `SELECT * FROM packlisten WHERE urlaub_id IN (${iv})`, bindVac)

  let packlisteIds: string[] = []
  try {
    const plR = await db
      .prepare(`SELECT id FROM packlisten WHERE urlaub_id IN (${iv})`)
      .bind(...bindVac)
      .all<{ id: string }>()
    packlisteIds = (plR.results ?? []).map((r) => r.id).filter(Boolean)
  } catch (e) {
    warnings.push(`packlisten IDs: ${e instanceof Error ? e.message : String(e)}`)
  }

  const ip = placeholders(packlisteIds.length)

  await tryQ(
    'packlisten_eintraege',
    packlisteIds.length
      ? `SELECT * FROM packlisten_eintraege WHERE packliste_id IN (${ip})`
      : `SELECT * FROM packlisten_eintraege WHERE 0`,
    packlisteIds
  )

  await tryQ(
    'packlisten_eintraege_temporaer',
    packlisteIds.length
      ? `SELECT * FROM packlisten_eintraege_temporaer WHERE packliste_id IN (${ip})`
      : `SELECT * FROM packlisten_eintraege_temporaer WHERE 0`,
    packlisteIds
  )

  let entryIds: string[] = []
  let tempEntryIds: string[] = []
  if (packlisteIds.length > 0) {
    try {
      const eR = await db
        .prepare(`SELECT id FROM packlisten_eintraege WHERE packliste_id IN (${ip})`)
        .bind(...packlisteIds)
        .all<{ id: string }>()
      entryIds = (eR.results ?? []).map((r) => r.id).filter(Boolean)
      const etR = await db
        .prepare(`SELECT id FROM packlisten_eintraege_temporaer WHERE packliste_id IN (${ip})`)
        .bind(...packlisteIds)
        .all<{ id: string }>()
      tempEntryIds = (etR.results ?? []).map((r) => r.id).filter(Boolean)
    } catch (e) {
      warnings.push(`entry ids: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const ie = placeholders(entryIds.length)
  await tryQ(
    'packlisten_eintrag_mitreisende',
    entryIds.length
      ? `SELECT * FROM packlisten_eintrag_mitreisende WHERE packlisten_eintrag_id IN (${ie})`
      : `SELECT * FROM packlisten_eintrag_mitreisende WHERE 0`,
    entryIds
  )

  const ite = placeholders(tempEntryIds.length)
  await tryQ(
    'packlisten_eintrag_mitreisende_temporaer',
    tempEntryIds.length
      ? `SELECT * FROM packlisten_eintrag_mitreisende_temporaer WHERE packlisten_eintrag_id IN (${ite})`
      : `SELECT * FROM packlisten_eintrag_mitreisende_temporaer WHERE 0`,
    tempEntryIds
  )

  return out
}

export async function buildBackupBundle(
  db: D1Database,
  options: ExportOptions
): Promise<{ bundle: BackupBundle; warnings: string[] }> {
  const warnings: string[] = []
  const includeAuth = options.includeAuth === true
  const vacuumIds = (options.vacationIds ?? []).filter((id) => typeof id === 'string' && id.length > 0)

  const tableSet = mergePresetTables(options.presets)
  if (includeAuth) {
    AUTH_TABLES.forEach((t) => tableSet.add(t))
  }
  if (!includeAuth) {
    AUTH_TABLES.forEach((t) => tableSet.delete(t))
  }

  const isFullExport = !options.presets?.length
  const hasReferencePreset =
    isFullExport ||
    Boolean(options.presets?.includes('referenceCore')) ||
    Boolean(options.presets?.includes('equipment')) ||
    Boolean(options.presets?.includes('referenceStammdaten'))
  const hasVacationsPreset =
    isFullExport || Boolean(options.presets?.includes('vacations'))
  const filterVacOnly = hasVacationsPreset && vacuumIds.length > 0
  const autoClosure = options.autoClosure !== false
  /** Nur presets (kein Komplett) + vacations + keine reference + Auto-Closure */
  const closureOnlyMode =
    filterVacOnly &&
    autoClosure &&
    !hasReferencePreset &&
    Boolean(options.presets?.length) &&
    hasVacationsPreset

  const tables = topologicalTableList(tableSet)
  const data: Record<string, BackupTableData> = {}

  let vacationPayload: Record<string, Record<string, unknown>[]> = {}
  if (closureOnlyMode) vacationPayload = await vacationClosureExports(db, vacuumIds, warnings)
  else if (filterVacOnly && hasVacationsPreset)
    vacationPayload = await filteredVacationTables(db, vacuumIds, warnings)

  if (closureOnlyMode) {
    const closed = vacationPayload
    for (const table of tables) {
      if (closed[table]) data[table] = closed[table] as BackupTableData
      else {
        const { rows, error } = await selectAllSafe(db, table)
        if (error) warnings.push(`${table}: ${error}`)
        data[table] = rows as BackupTableData
      }
    }
  } else {
    for (const table of tables) {
      if (filterVacOnly && hasVacationsPreset && VACATION_TABLES.has(table)) {
        const rowsVac = vacationPayload[table]
        data[table] = (rowsVac ?? []) as BackupTableData
        continue
      }
      const { rows, error } = await selectAllSafe(db, table)
      if (error) warnings.push(`${table}: ${error}`)
      data[table] = rows as BackupTableData
    }

    if (
      filterVacOnly &&
      hasVacationsPreset &&
      autoClosure &&
      !hasReferencePreset &&
      Boolean(options.presets?.length)
    ) {
      const closed = await vacationClosureExports(db, vacuumIds, warnings)
      for (const [k, rows] of Object.entries(closed)) {
        if (!tableSet.has(k)) continue
        data[k] = mergeRows(k, data[k] ?? [], rows ?? []) as BackupTableData
      }
    }
  }

  for (const t of tables) if (data[t] === undefined) data[t] = []

  if (!includeAuth && isFullExport) {
    tables.forEach((t) => {
      if (AUTH_TABLES.has(t)) data[t] = []
    })
  }

  const bundle: BackupBundle = {
    meta: {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      domains: domainLabelsForPresets(options.presets),
      options: {
        presets: options.presets,
        vacationIds: vacuumIds.length ? vacuumIds : undefined,
        autoClosure,
        includeAuth,
      },
    },
    data,
  }

  return { bundle, warnings }
}
