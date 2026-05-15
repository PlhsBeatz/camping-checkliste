import type { BackupPreset } from './types'

/** FK-sichere Reihenfolge für Merge-Import */
export const BACKUP_TABLE_ORDER: string[] = [
  'hauptkategorien',
  'transportmittel',
  'mitreisende',
  'tag_kategorien',
  'users',
  'kategorien',
  'tags',
  'campingplaetze',
  'packlisten_vorlagen',
  'einladungen',
  'mitreisende_berechtigungen',
  'ausruestungsgegenstaende',
  'transportmittel_festgewicht_manuell',
  'ausruestungsgegenstaende_links',
  'ausruestungsgegenstaende_standard_mitreisende',
  'ausruestungsgegenstaende_tags',
  'vorlagen_eintraege',
  'campingplatz_fotos',
  'urlaube',
  'urlaub_mitreisende',
  'urlaub_campingplaetze',
  'packlisten',
  'packlisten_eintraege_temporaer',
  'packlisten_eintraege',
  'packlisten_eintrag_mitreisende',
  'packlisten_eintrag_mitreisende_temporaer',
  'campingplatz_routen_cache',
  'checklisten',
  'checklisten_kategorien',
  'checklisten_eintraege',
]

/** Legacy-API: gleiche Tabellen wie equipment ∪ referenceStammdaten */
const REFERENCE_CORE = new Set([
  'hauptkategorien',
  'kategorien',
  'transportmittel',
  'transportmittel_festgewicht_manuell',
  'tag_kategorien',
  'tags',
  'mitreisende',
  'ausruestungsgegenstaende',
  'ausruestungsgegenstaende_links',
  'ausruestungsgegenstaende_standard_mitreisende',
  'ausruestungsgegenstaende_tags',
  'packlisten_vorlagen',
  'vorlagen_eintraege',
])

/** Nur Ausrüstungs-Inventar und direkte Verknüpfungen */
const EQUIPMENT_REF = new Set([
  'ausruestungsgegenstaende',
  'ausruestungsgegenstaende_links',
  'ausruestungsgegenstaende_standard_mitreisende',
  'ausruestungsgegenstaende_tags',
])

/** Pack-/Organisations-Stamm ohne Ausrüstungs-Inventar */
const REFERENCE_STAMMDATEN = new Set([
  'hauptkategorien',
  'kategorien',
  'transportmittel',
  'transportmittel_festgewicht_manuell',
  'tag_kategorien',
  'tags',
  'mitreisende',
  'packlisten_vorlagen',
  'vorlagen_eintraege',
])

const VACATIONS = new Set([
  'urlaube',
  'urlaub_mitreisende',
  'urlaub_campingplaetze',
  'packlisten',
  'packlisten_eintraege',
  'packlisten_eintrag_mitreisende',
  'packlisten_eintraege_temporaer',
  'packlisten_eintrag_mitreisende_temporaer',
])

const PLACES = new Set(['campingplaetze', 'campingplatz_fotos', 'urlaub_campingplaetze'])
const TOOLS = new Set(['checklisten', 'checklisten_kategorien', 'checklisten_eintraege'])
export const AUTH_TABLES = new Set([
  'users',
  'einladungen',
  'mitreisende_berechtigungen',
  'campingplatz_routen_cache',
])

/** Primärschlüssel-Spalten pro Tabelle für Dedupe beim Export */
export const PK_PARTS: Record<string, string[]> = {
  hauptkategorien: ['id'],
  transportmittel: ['id'],
  mitreisende: ['id'],
  tag_kategorien: ['id'],
  users: ['id'],
  kategorien: ['id'],
  tags: ['id'],
  campingplaetze: ['id'],
  packlisten_vorlagen: ['id'],
  einladungen: ['id'],
  mitreisende_berechtigungen: ['mitreisender_id', 'berechtigung'],
  ausruestungsgegenstaende: ['id'],
  transportmittel_festgewicht_manuell: ['id'],
  ausruestungsgegenstaende_links: ['id'],
  ausruestungsgegenstaende_standard_mitreisende: ['gegenstand_id', 'mitreisender_id'],
  ausruestungsgegenstaende_tags: ['gegenstand_id', 'tag_id'],
  vorlagen_eintraege: ['vorlage_id', 'gegenstand_id'],
  campingplatz_fotos: ['id'],
  urlaube: ['id'],
  urlaub_mitreisende: ['urlaub_id', 'mitreisender_id'],
  urlaub_campingplaetze: ['urlaub_id', 'campingplatz_id'],
  packlisten: ['id'],
  packlisten_eintraege_temporaer: ['id'],
  packlisten_eintraege: ['id'],
  packlisten_eintrag_mitreisende: ['packlisten_eintrag_id', 'mitreisender_id'],
  packlisten_eintrag_mitreisende_temporaer: ['packlisten_eintrag_id', 'mitreisender_id'],
  campingplatz_routen_cache: ['user_id', 'campingplatz_id'],
  checklisten: ['id'],
  checklisten_kategorien: ['id'],
  checklisten_eintraege: ['id'],
}

export function rowKey(table: string, row: Record<string, unknown>): string {
  const parts = PK_PARTS[table]
  if (!parts) return JSON.stringify(row)
  return parts.map((p) => String(row[p] ?? '')).join('\0')
}

export function tablesForPreset(p: BackupPreset): Set<string> {
  switch (p) {
    case 'referenceCore':
      return REFERENCE_CORE
    case 'equipment':
      return EQUIPMENT_REF
    case 'referenceStammdaten':
      return REFERENCE_STAMMDATEN
    case 'vacations':
      return VACATIONS
    case 'places':
      return PLACES
    case 'toolsChecklists':
      return TOOLS
    case 'auth':
      return AUTH_TABLES
  }
}

/** Keine presets = Komplett (alle Tabellen) */
export function mergePresetTables(presets: BackupPreset[] | undefined): Set<string> {
  const s = new Set<string>()
  if (!presets?.length) {
    BACKUP_TABLE_ORDER.forEach((t) => s.add(t))
    return s
  }
  for (const p of presets) {
    tablesForPreset(p).forEach((t) => s.add(t))
  }
  return s
}

export function topologicalTableList(selected: Set<string>): string[] {
  return BACKUP_TABLE_ORDER.filter((t) => selected.has(t))
}

export function domainLabelsForPresets(presets: BackupPreset[] | undefined): string[] {
  if (!presets?.length) return ['full']
  return [...presets]
}
