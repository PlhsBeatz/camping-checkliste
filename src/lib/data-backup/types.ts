/** JSON-Backup-Bundle (Admin). Bei inkompatiblem Umschlag formatVersion erhöhen. */
export const BACKUP_FORMAT_VERSION = 1 as const

export type BackupPreset =
  | 'referenceCore'
  | 'equipment'
  | 'referenceStammdaten'
  | 'vacations'
  | 'places'
  | 'toolsChecklists'
  | 'auth'

export interface BackupMeta {
  /** Aktuelle Exportversion; ältere Importdateien können kleinere Werte haben. */
  formatVersion: number
  exportedAt: string
  domains: string[]
  options?: {
    presets?: BackupPreset[]
    vacationIds?: string[]
    autoClosure?: boolean
    includeAuth?: boolean
  }
}

export type BackupTableData = Record<string, unknown>[]

export interface BackupBundle {
  meta: BackupMeta
  data: Record<string, BackupTableData>
}

export interface ExportOptions {
  presets?: BackupPreset[]
  vacationIds?: string[]
  autoClosure?: boolean
  /** Inkl. Passwort-Hashes, Einladungs-Tokens, Routen-Cache — höchste Sensibilität */
  includeAuth?: boolean
}

export type ImportMode = 'mergeById'

export interface ImportResult {
  dryRun: boolean
  mode: ImportMode
  sourceFormatVersion: number
  tablesWritten: Record<string, number>
  warnings: string[]
  errors: string[]
}
