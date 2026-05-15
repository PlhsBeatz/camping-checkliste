/**
 * Backup-Bundle in D1 importieren (Admin, mergeById = INSERT OR REPLACE).
 */
import type { D1Database } from '@cloudflare/workers-types'

import type { BackupBundle, ImportResult, ImportMode } from './types'
import { BACKUP_FORMAT_VERSION } from './types'
import { BACKUP_TABLE_ORDER } from './tables'

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  return null
}

export function normalizeImportBundle(raw: unknown): { bundle: BackupBundle; warnings: string[] } {
  const warnings: string[] = []
  if (!raw || typeof raw !== 'object') {
    throw new Error('Ungültiges Backup: kein Objekt')
  }
  const obj = raw as Record<string, unknown>
  const metaRaw = asRecord(obj.meta)
  const dataRaw = asRecord(obj.data)
  if (!dataRaw) throw new Error('Ungültiges Backup: data fehlt oder ist kein Objekt')

  let formatVersion: number = BACKUP_FORMAT_VERSION
  if (metaRaw?.formatVersion !== undefined && metaRaw.formatVersion !== null) {
    const v = Number(metaRaw.formatVersion)
    if (!Number.isFinite(v)) warnings.push('formatVersion unklar — es wird fortgesetzt.')
    else formatVersion = v
  } else warnings.push(`meta.formatVersion fehlt — angenommen: ${BACKUP_FORMAT_VERSION}`)

  const exportedAt =
    typeof metaRaw?.exportedAt === 'string' ? metaRaw.exportedAt : new Date().toISOString()
  const domains = Array.isArray(metaRaw?.domains)
    ? (metaRaw!.domains as unknown[]).filter((d): d is string => typeof d === 'string')
    : ([] as string[])
  const options = asRecord(metaRaw?.options) ?? undefined

  const data: Record<string, Record<string, unknown>[]> = {}
  for (const [k, v] of Object.entries(dataRaw)) {
    if (!Array.isArray(v)) {
      warnings.push(`Tabelle ${k}: Wert ist kein Array — übersprungen.`)
      continue
    }
    data[k] = v.map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return {}
      return { ...(row as Record<string, unknown>) }
    })
  }

  const bundle: BackupBundle = {
    meta: {
      formatVersion,
      exportedAt,
      domains,
      options: options as BackupBundle['meta']['options'],
    },
    data,
  }
  return { bundle, warnings }
}

const pragmaCache = new WeakMap<
  D1Database,
  Map<string, Set<string>>
>()

async function getColumnSet(db: D1Database, table: string): Promise<Set<string> | null> {
  let m = pragmaCache.get(db)
  if (!m) {
    m = new Map()
    pragmaCache.set(db, m)
  }
  const hit = m.get(table)
  if (hit) return hit
  try {
    const r = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>()
    const set = new Set((r.results ?? []).map((x) => x.name).filter(Boolean))
    m.set(table, set)
    return set
  } catch {
    return null
  }
}

function filterRowForTable(
  table: string,
  row: Record<string, unknown>,
  allowed: Set<string> | null
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(row)) {
    if (allowed && !allowed.has(k)) continue
    if (val === undefined) continue
    out[k] = val
  }
  return out
}

export async function importBackupBundle(
  db: D1Database,
  bundle: BackupBundle,
  opts: { dryRun: boolean; mode: ImportMode }
): Promise<ImportResult> {
  const warnings: string[] = []
  const errors: string[] = []
  const tablesWritten: Record<string, number> = {}
  const sourceFormatVersion = Number(bundle.meta.formatVersion) || 1

  if (opts.mode !== 'mergeById') {
    errors.push(`Import-Modus "${opts.mode}" wird nicht unterstützt.`)
    return {
      dryRun: opts.dryRun,
      mode: opts.mode,
      sourceFormatVersion,
      tablesWritten: {},
      warnings,
      errors,
    }
  }

  const order = BACKUP_TABLE_ORDER.filter((t) => bundle.data[t]?.length)

  for (const table of order) {
    const rows = bundle.data[table] ?? []
    if (rows.length === 0) continue

    const allowed = await getColumnSet(db, table)
    if (!allowed || allowed.size === 0) {
      warnings.push(`Tabelle ${table}: existiert nicht oder PRAGMA fehlgeschlagen — übersprungen.`)
      continue
    }

    let count = 0

    for (const rawRow of rows) {
      if (table === 'users') {
        const ph = rawRow.password_hash
        if (ph === undefined || ph === null || ph === '') {
          warnings.push(
            `users: Zeile ${String(rawRow.id ?? '?')} ohne password_hash — übersprungen (typisch bei Export ohne includeAuth).`
          )
          continue
        }
      }
      if (table === 'einladungen') {
        const tok = rawRow.token
        if (tok === undefined || tok === null || String(tok) === '') {
          warnings.push(`einladungen: Zeile ${String(rawRow.id ?? '?')} ohne token — übersprungen.`)
          continue
        }
      }

      const row = filterRowForTable(table, rawRow, allowed)
      const cols = Object.keys(row)
      if (cols.length === 0) continue
      const vals = cols.map((c) => row[c])
      const qm = cols.map(() => '?').join(', ')
      const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${qm})`
      try {
        if (!opts.dryRun) await db.prepare(sql).bind(...vals).run()
        count++
      } catch (e) {
        errors.push(`${table} ${String(rawRow.id ?? count)}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    tablesWritten[table] = count
  }

  /** Tabellen im Bundle aber leer / nicht in order */
  for (const t of Object.keys(bundle.data)) {
    if (!BACKUP_TABLE_ORDER.includes(t)) {
      warnings.push(`Unbekannte Tabelle im Backup ignoriert: ${t}`)
    }
  }

  return {
    dryRun: opts.dryRun,
    mode: opts.mode,
    sourceFormatVersion,
    tablesWritten,
    warnings,
    errors,
  }
}
