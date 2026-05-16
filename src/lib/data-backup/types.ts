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
    /** Campingplatz-Bilder aus R2 (ZIP-Export mit separaten Dateien) */
    includeR2Photos?: boolean
  }
}

export type BackupTableData = Record<string, unknown>[]

/** Ein Campingplatz-Foto in R2; Key entspricht campingplatz_fotos.r2_object_key */
export interface R2CampingPhotoEntry {
  key: string
  contentType: string
  /** Rohe Bildbytes als Base64 */
  dataBase64: string
}

export interface BackupBundle {
  meta: BackupMeta
  data: Record<string, BackupTableData>
  /** Optional: nur noch für ältere JSON-Imports mit eingebettetem Base64. */
  r2CampingPhotos?: R2CampingPhotoEntry[]
}

export interface ExportOptions {
  presets?: BackupPreset[]
  vacationIds?: string[]
  autoClosure?: boolean
  /** Inkl. Passwort-Hashes, Einladungs-Tokens, Routen-Cache — höchste Sensibilität */
  includeAuth?: boolean
  /** Binär-Bilder: ZIP-Export (backup.json + r2/…) */
  includeR2Photos?: boolean
}

export type ImportMode = 'mergeById'

export interface ImportResult {
  dryRun: boolean
  mode: ImportMode
  sourceFormatVersion: number
  tablesWritten: Record<string, number>
  warnings: string[]
  errors: string[]
  /** Geschriebene R2-Objekte (nur wenn Bundle r2CampingPhotos enthielt) */
  r2ObjectsWritten?: number
}
