import type { BackupPreset } from './types'

/** FK-sichere Reihenfolge für Merge-Import */
export const BACKUP_TABLE_ORDER: string[] = [
  'hauptkategorien',
  'transportmittel',
  'mitreisenden_gruppe',
  'mitreisende',
  'tag_kategorien',
  'users',
  'kategorien',
  'tags',
  'campingplaetze',
  'rastplaetze',
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
  'urlaub_campingplatz_emails',
  'booking_import_pending',
  'packlisten',
  'packlisten_eintraege_temporaer',
  'packlisten_eintraege',
  'packlisten_eintrag_mitreisende',
  'packlisten_eintrag_mitreisende_temporaer',
  'packlisten_eintrag_gruppen',
  'packlisten_eintrag_gruppen_temporaer',
  'campingplatz_routen_cache',
  'campingplatz_segment_routen_cache',
  'checklisten',
  'checklisten_kategorien',
  'checklisten_eintraege',
  'optimierungen',
  'optimierungen_links',
  'optimierungen_fotos',
  'faelligkeit_vorlagen',
  'faelligkeiten',
  'faelligkeiten_historie',
  'verbrauch_messungen',
  'attention_snooze',
  'smart_vorschlaege',
  'packing_pattern_snapshot',
  'ausruestung_alternativgruppen',
  'ausruestung_alternativgruppe_items',
  'ai_call_cache',
]

/** Legacy-API: gleiche Tabellen wie equipment ∪ referenceStammdaten */
const REFERENCE_CORE = new Set([
  'hauptkategorien',
  'kategorien',
  'transportmittel',
  'transportmittel_festgewicht_manuell',
  'tag_kategorien',
  'tags',
  'mitreisenden_gruppe',
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
  'mitreisenden_gruppe',
  'mitreisende',
  'packlisten_vorlagen',
  'vorlagen_eintraege',
])

const VACATIONS = new Set([
  'urlaube',
  'urlaub_mitreisende',
  'urlaub_campingplaetze',
  'urlaub_campingplatz_emails',
  'booking_import_pending',
  'packlisten',
  'packlisten_eintraege',
  'packlisten_eintrag_mitreisende',
  'packlisten_eintraege_temporaer',
  'packlisten_eintrag_mitreisende_temporaer',
  'packlisten_eintrag_gruppen',
  'packlisten_eintrag_gruppen_temporaer',
])

const PLACES = new Set([
  'campingplaetze',
  'campingplatz_fotos',
  'urlaub_campingplaetze',
  'campingplatz_segment_routen_cache',
])
const TOOLS = new Set([
  'checklisten',
  'checklisten_kategorien',
  'checklisten_eintraege',
  'optimierungen',
  'optimierungen_links',
  'optimierungen_fotos',
  'attention_snooze',
  'smart_vorschlaege',
  'packing_pattern_snapshot',
  'ausruestung_alternativgruppen',
  'ausruestung_alternativgruppe_items',
])

/** Wartung & Verbrauch (Fälligkeiten, Vorlagen, Historie, Messungen) */
export const WARTUNG_TABLES = new Set([
  'faelligkeit_vorlagen',
  'faelligkeiten',
  'faelligkeiten_historie',
  'verbrauch_messungen',
])
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
  mitreisenden_gruppe: ['id'],
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
  urlaub_campingplaetze: ['id'],
  urlaub_campingplatz_emails: ['id'],
  booking_import_pending: ['id'],
  packlisten: ['id'],
  packlisten_eintraege_temporaer: ['id'],
  packlisten_eintraege: ['id'],
  packlisten_eintrag_mitreisende: ['packlisten_eintrag_id', 'mitreisender_id'],
  packlisten_eintrag_mitreisende_temporaer: ['packlisten_eintrag_id', 'mitreisender_id'],
  packlisten_eintrag_gruppen: ['id'],
  packlisten_eintrag_gruppen_temporaer: ['id'],
  campingplatz_routen_cache: ['user_id', 'campingplatz_id'],
  campingplatz_segment_routen_cache: ['from_campingplatz_id', 'to_campingplatz_id'],
  checklisten: ['id'],
  checklisten_kategorien: ['id'],
  checklisten_eintraege: ['id'],
  optimierungen: ['id'],
  optimierungen_links: ['id'],
  optimierungen_fotos: ['id'],
  faelligkeit_vorlagen: ['id'],
  faelligkeiten: ['id'],
  faelligkeiten_historie: ['id'],
  verbrauch_messungen: ['id'],
  attention_snooze: ['item_key'],
  smart_vorschlaege: ['id'],
  packing_pattern_snapshot: ['id'],
  ausruestung_alternativgruppen: ['id'],
  ausruestung_alternativgruppe_items: ['gruppe_id', 'gegenstand_id'],
  ai_call_cache: ['cache_key'],
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
    case 'wartung':
      return WARTUNG_TABLES
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
