/**
 * Datenbank-Adapter für Cloudflare D1
 * Dieser Adapter bietet Funktionen für die Interaktion mit der D1-Datenbank
 * unter Verwendung der deutschen Tabellennamen aus dem ursprünglichen Schema.
 */

import { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { MengenRegel } from './packing-quantity'
import { parseRegel, serializeRegel } from './packing-quantity'

export interface Vacation {
  id: string
  titel: string
  startdatum: string
  abfahrtdatum?: string | null
  enddatum: string
  reiseziel_name: string
  reiseziel_adresse?: string | null
  land_region?: string | null
  /** Standardansicht der Packliste: 'packliste' oder 'alles'. Default: 'packliste' */
  packliste_default_ansicht?: 'packliste' | 'alles' | null
  created_at: string
}

export interface PackingItem {
  id: string
  packliste_id: string
  gegenstand_id: string
  anzahl: number
  gepackt: boolean
  /** Vorgemerkt durch Kind (noch nicht von Admin bestätigt) */
  gepackt_vorgemerkt?: boolean
  gepackt_vorgemerkt_durch?: string | null
  bemerkung?: string | null
  transport_id?: string | null
  transport_name?: string
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte'
  mitreisende?: PackingItemMitreisender[] // Zugeordnete Mitreisende mit Gepackt-Status
  was: string // Gejoint aus ausruestungsgegenstaende oder temporär: aus packlisten_eintraege_temporaer
  kategorie: string // Gejoint
  hauptkategorie: string // Gejoint
  details?: string
  einzelgewicht?: number
  /** Status des Ausrüstungsgegenstands (z.B. "Normal", "Immer gepackt") */
  status?: string
  /** Erst am Abreisetag zu packen – im Packliste-Modus nur an diesem Tag anzeigen */
  erst_abreisetag_gepackt?: boolean
  created_at: string
  /** Nur für diese Packliste, nicht in der Ausrüstung gespeichert */
  is_temporaer?: boolean
  /** Nur bei temporären Einträgen: bearbeitbare Kategorie-ID */
  kategorie_id?: string
  /** Intern für Sortierung (hauptkategorie/kategorie Reihenfolge) */
  orderHk?: number
  orderK?: number
}

export interface PackingItemMitreisender {
  mitreisender_id: string
  mitreisender_name: string
  gepackt: boolean
  /** Vorgemerkt (noch nicht von Admin bestätigt) */
  gepackt_vorgemerkt?: boolean
  /** Pro-Person-Anzahl; bei undefined wird item.anzahl verwendet */
  anzahl?: number
  /** Pro-Person-Transport; bei undefined wird item.transport_id verwendet */
  transport_id?: string | null
  transport_name?: string
}

export interface Mitreisender {
  id: string
  name: string
  user_id?: string | null
  /** E-Mail des zugeordneten Users (nur wenn user_id gesetzt) */
  user_email?: string | null
  /** Rolle des zugeordneten Users (nur wenn user_id gesetzt) */
  user_role?: 'admin' | 'kind' | 'gast' | null
  is_default_member: boolean
  farbe?: string | null
  created_at: string
}

export interface EquipmentItem {
  id: string
  was: string
  kategorie_id: string
  kategorie_titel?: string
  hauptkategorie_titel?: string
  transport_id: string | null
  transport_name?: string
  einzelgewicht: number
  standard_anzahl: number
  status: string
  details: string
  is_standard: boolean // Immer dabei
  erst_abreisetag_gepackt?: boolean // Erst am Abreisetag packen
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte'
  standard_mitreisende?: string[] // IDs der standardmäßig zugeordneten Mitreisenden
  in_pauschale_inbegriffen?: boolean // Gewicht in Pauschale (Kategorie/Hauptkategorie) enthalten
  tags?: Tag[] // Zugeordnete Tags
  links?: EquipmentLink[]
  /**
   * Dynamische Mengenregel (optional). Wird beim Generieren der Packliste
   * abhängig von Reisedauer und Mitreisenden-Typ (Erwachsener/Kind)
   * ausgewertet. `null`/undefined → Fallback auf `standard_anzahl`.
   */
  mengenregel?: MengenRegel | null
  created_at: string
}

export interface EquipmentLink {
  id: string
  gegenstand_id: string
  url: string
  created_at: string
}

export interface TransportVehicle {
  id: string
  name: string
  zul_gesamtgewicht: number
  eigengewicht: number
  fest_installiert_mitrechnen: boolean
  created_at: string
}

export interface TransportVehicleFestgewichtManuell {
  id: string
  transport_id: string
  titel: string
  gewicht: number
  created_at: string
}

export interface Category {
  id: string
  titel: string
  hauptkategorie_id: string
  reihenfolge: number
  pauschalgewicht?: number | null
  pauschal_pro_person?: boolean
  pauschal_transport_id?: string | null
}

export interface MainCategory {
  id: string
  titel: string
  reihenfolge: number
  pauschalgewicht?: number | null
  pauschal_pro_person?: boolean
  pauschal_transport_id?: string | null
}

/** Kategorie für die Verwaltungs-Ansicht der Tags (z. B. Zeit, Aktivitäten) */
export interface TagKategorie {
  id: string
  titel: string
  reihenfolge: number
  created_at: string
}

export interface Tag {
  id: string
  titel: string
  farbe?: string | null
  icon?: string | null
  beschreibung?: string | null
  tag_kategorie_id: string
  reihenfolge: number
  created_at: string
}

export type CampingplatzTyp = 'Durchreise' | 'Urlaubsplatz' | 'Stellplatz'

export interface CampingplatzFoto {
  id: string
  campingplatz_id: string
  sort_index: number
  is_cover: boolean
  source: 'google' | 'upload'
  google_photo_name: string | null
  r2_object_key: string | null
  content_type: string
  /** JSON-Array von Attribution-Strings (Google Places) */
  google_attributions_json: string | null
  created_at: string
}

export interface Campingplatz {
  id: string
  name: string
  land: string
  bundesland?: string | null
  ort: string
  webseite?: string | null
  video_link?: string | null
  platz_typ: CampingplatzTyp
  pros: string[]
  cons: string[]
  adresse?: string | null
  lat?: number | null
  lng?: number | null
  /** Google Places Photo Resource-Name (z. B. places/ChIJ.../photos/...) */
  photo_name?: string | null
  is_archived: boolean
  /** Auf Wunschliste (aktive Plätze); unabhängig vom Archiv */
  aufwunschliste: boolean
  /** Top-Lieblingsplatz */
  top_favorit: boolean
  created_at: string
  updated_at?: string
  /** Aus JOIN campingplatz_fotos (is_cover = 1) */
  cover_foto_id?: string | null
  cover_r2_object_key?: string | null
  cover_google_photo_name?: string | null
  /** Anzahl Urlaube mit diesem Campingplatz (API; Junction urlaub_campingplaetze) */
  urlaube_zuordnungen?: number
  /** Nur Listen-GET: gecachte Fahrt von der Nutzer-Heimat */
  route_from_home?: {
    distanceKm: number
    durationMinutes: number
    provider: 'google' | 'haversine'
  } | null
}

export interface CampingplatzRouteCacheEntry {
  user_id: string
  campingplatz_id: string
  distance_km: number
  duration_min: number
  provider: 'google' | 'haversine'
  updated_at: string
}

export type UserRole = 'admin' | 'kind' | 'gast'

export interface User {
  id: string
  email: string
  password_hash: string
  role: UserRole
  mitreisender_id: string | null
  password_reset_token?: string | null
  password_reset_expires?: string | null
  /** Nach Admin-Passwort-Reset: User muss beim nächsten Login Passwort ändern */
  must_change_password?: number
  /** Heimatadresse für Routenberechnung (frei formatiert) */
  heimat_adresse?: string | null
  heimat_lat?: number | null
  heimat_lng?: number | null
  created_at: string
  updated_at: string
}

export interface Einladung {
  id: string
  token: string
  mitreisender_id: string
  role: 'kind' | 'gast'
  erstellt_von: string | null
  eingeladen_am: string
  angenommen_am: string | null
  ablauf: string | null
}

/** Tools: benutzerdefinierte Checklisten (Abfahrt, Einwintern, …) */
export interface Checkliste {
  id: string
  titel: string
  reihenfolge: number
  created_at: string
  updated_at?: string
}

export interface ChecklisteKategorie {
  id: string
  checklist_id: string
  titel: string
  reihenfolge: number
  created_at: string
  updated_at?: string
}

export interface ChecklisteEintrag {
  id: string
  checklist_id: string
  kategorie_id: string
  text: string
  reihenfolge: number
  erledigt: boolean
  created_at: string
  updated_at?: string
}

export interface ChecklisteMitStruktur extends Checkliste {
  kategorien: (ChecklisteKategorie & { eintraege: ChecklisteEintrag[] })[]
}

export interface CloudflareEnv {
  DB: D1Database
  PACKING_SYNC_DO?: DurableObjectNamespace
  CAMPING_PHOTOS?: R2Bucket
  GOOGLE_MAPS_API_KEY?: string
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string
}

/**
 * Hilfsfunktion zum Abrufen der D1-Datenbank aus dem Kontext
 */
export function getDB(env?: CloudflareEnv): D1Database {
  // Versuche die DB aus dem OpenNext CloudflareContext zu erhalten (empfohlen für OpenNext)
  try {
    const { env: cloudflareEnv } = getCloudflareContext();
    if (cloudflareEnv?.DB) {
      return cloudflareEnv.DB as unknown as D1Database;
    }
  } catch {
    // Falls getCloudflareContext fehlschlägt (z.B. lokal ohne OpenNext), fahre mit env fort
  }

  // Fallback auf das übergebene env Objekt
  if (env?.DB) {
    return env.DB;
  }

  // Letzter Versuch: process.env (manchmal von Cloudflare injiziert)
  const processEnv = process.env as unknown as CloudflareEnv;
  if (processEnv?.DB) {
    return processEnv.DB;
  }

  throw new Error('D1 Database binding "DB" not found. Bitte stellen Sie sicher, dass die Datenbank im Cloudflare Dashboard korrekt an den Worker gebunden ist.');
}

export function getCampingPhotosR2(env?: CloudflareEnv): R2Bucket | null {
  try {
    const { env: cloudflareEnv } = getCloudflareContext()
    const b = (cloudflareEnv as CloudflareEnv | undefined)?.CAMPING_PHOTOS
    if (b) return b as R2Bucket
  } catch {
    /* lokal ohne Worker */
  }
  if (env?.CAMPING_PHOTOS) return env.CAMPING_PHOTOS
  const processEnv = process.env as unknown as CloudflareEnv
  return processEnv?.CAMPING_PHOTOS ?? null
}

function mapCampingplatzRow(row: Record<string, unknown>): Campingplatz {
  return {
    id: String(row.id),
    name: String(row.name),
    land: String(row.land),
    bundesland: row.bundesland != null ? String(row.bundesland) : null,
    ort: String(row.ort),
    webseite: row.webseite != null ? String(row.webseite) : null,
    video_link: row.video_link != null ? String(row.video_link) : null,
    platz_typ: String(row.platz_typ) as CampingplatzTyp,
    pros: row.pros ? JSON.parse(String(row.pros)) : [],
    cons: row.cons ? JSON.parse(String(row.cons)) : [],
    adresse: row.adresse != null ? String(row.adresse) : null,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
    photo_name: row.photo_name != null ? String(row.photo_name) : null,
    is_archived: !!(row.is_archived ?? 0),
    aufwunschliste:
      row.aufwunschliste === undefined || row.aufwunschliste === null
        ? true
        : !!(row.aufwunschliste ?? 0),
    top_favorit: !!(row.top_favorit ?? 0),
    created_at: String(row.created_at || ''),
    updated_at: row.updated_at != null ? String(row.updated_at) : undefined,
    cover_foto_id:
      row.cover_foto_id != null && String(row.cover_foto_id) !== ''
        ? String(row.cover_foto_id)
        : null,
    cover_r2_object_key:
      row.cover_r2_object_key != null && String(row.cover_r2_object_key) !== ''
        ? String(row.cover_r2_object_key)
        : null,
    cover_google_photo_name:
      row.cover_google_photo_name != null && String(row.cover_google_photo_name) !== ''
        ? String(row.cover_google_photo_name)
        : null,
  }
}

function mapCampingplatzFotoRow(row: Record<string, unknown>): CampingplatzFoto {
  return {
    id: String(row.id),
    campingplatz_id: String(row.campingplatz_id),
    sort_index: Number(row.sort_index ?? 0),
    is_cover: !!(row.is_cover ?? 0),
    source: row.source === 'upload' ? 'upload' : 'google',
    google_photo_name: row.google_photo_name != null ? String(row.google_photo_name) : null,
    r2_object_key: row.r2_object_key != null ? String(row.r2_object_key) : null,
    content_type: row.content_type != null ? String(row.content_type) : 'image/jpeg',
    google_attributions_json:
      row.google_attributions_json != null ? String(row.google_attributions_json) : null,
    created_at: String(row.created_at || ''),
  }
}

/**
 * Initialisiert die Datenbank mit dem Schema (falls nicht vorhanden)
 * Hinweis: In Cloudflare Pages sollte dies idealerweise über Wrangler Migrations geschehen.
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    // Wir prüfen nur auf eine Tabelle, um zu sehen, ob das Schema existiert
    const tables = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='urlaube'"
    ).all()

    if (tables.results.length === 0) {
      console.log('Database tables not found. Please run wrangler d1 execute with migrations/0001_initial.sql')
    }
  } catch (error) {
    console.error('Database check error:', error)
  }
}

/**
 * Abrufen aller Urlaubsreisen
 * Für Gäste: optional nur Urlaube, in denen der Mitreisende enthalten ist
 */
export async function getVacations(
  db: D1Database,
  mitreisenderIdFilter?: string | null
): Promise<Vacation[]> {
  try {
    if (mitreisenderIdFilter) {
      const result = await db
        .prepare(
          `SELECT u.* FROM urlaube u
           INNER JOIN urlaub_mitreisende um ON u.id = um.urlaub_id
           WHERE um.mitreisender_id = ?
           ORDER BY u.startdatum DESC`
        )
        .bind(mitreisenderIdFilter)
        .all<Vacation>()
      return result.results || []
    }
    const result = await db.prepare('SELECT * FROM urlaube ORDER BY startdatum DESC').all<Vacation>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching vacations:', error)
    return []
  }
}

/**
 * Abrufen einer einzelnen Urlaubsreise
 */
export async function getVacation(db: D1Database, id: string): Promise<Vacation | null> {
  try {
    const result = await db.prepare('SELECT * FROM urlaube WHERE id = ?').bind(id).first<Vacation>()
    return result || null
  } catch (error) {
    console.error('Error fetching vacation:', error)
    return null
  }
}

/**
 * Erstellen einer neuen Urlaubsreise
 */
export async function createVacation(
  db: D1Database,
  vacation: { 
    titel: string
    startdatum: string
    abfahrtdatum?: string | null
    enddatum: string
    reiseziel_name: string
    reiseziel_adresse?: string | null
    land_region?: string | null
    packliste_default_ansicht?: 'packliste' | 'alles' | null
  }
): Promise<Vacation | null> {
  try {
    const id = crypto.randomUUID()
    const defaultAnsicht = vacation.packliste_default_ansicht === 'alles' ? 'alles' : 'packliste'
    await db
      .prepare(
        'INSERT INTO urlaube (id, titel, startdatum, abfahrtdatum, enddatum, reiseziel_name, reiseziel_adresse, land_region, packliste_default_ansicht) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id, 
        vacation.titel, 
        vacation.startdatum, 
        vacation.abfahrtdatum || null,
        vacation.enddatum, 
        vacation.reiseziel_name,
        vacation.reiseziel_adresse || null,
        vacation.land_region || null,
        defaultAnsicht
      )
      .run()

    // Auch eine Packliste für diesen Urlaub erstellen
    const packlisteId = crypto.randomUUID()
    await db.prepare('INSERT INTO packlisten (id, urlaub_id) VALUES (?, ?)').bind(packlisteId, id).run()

    return getVacation(db, id)
  } catch (error) {
    console.error('Error creating vacation:', error)
    return null
  }
}

/**
 * Aktualisieren einer Urlaubsreise
 */
export async function updateVacation(
  db: D1Database,
  id: string,
  updates: { 
    titel?: string
    startdatum?: string
    abfahrtdatum?: string | null
    enddatum?: string
    reiseziel_name?: string
    reiseziel_adresse?: string | null
    land_region?: string | null
    packliste_default_ansicht?: 'packliste' | 'alles' | null
  }
): Promise<Vacation | null> {
  try {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (updates.titel !== undefined) {
      fields.push('titel = ?')
      values.push(updates.titel)
    }
    if (updates.startdatum !== undefined) {
      fields.push('startdatum = ?')
      values.push(updates.startdatum)
    }
    if (updates.abfahrtdatum !== undefined) {
      fields.push('abfahrtdatum = ?')
      values.push(updates.abfahrtdatum)
    }
    if (updates.enddatum !== undefined) {
      fields.push('enddatum = ?')
      values.push(updates.enddatum)
    }
    if (updates.reiseziel_name !== undefined) {
      fields.push('reiseziel_name = ?')
      values.push(updates.reiseziel_name)
    }
    if (updates.reiseziel_adresse !== undefined) {
      fields.push('reiseziel_adresse = ?')
      values.push(updates.reiseziel_adresse)
    }
    if (updates.land_region !== undefined) {
      fields.push('land_region = ?')
      values.push(updates.land_region)
    }
    if (updates.packliste_default_ansicht !== undefined) {
      fields.push('packliste_default_ansicht = ?')
      values.push(updates.packliste_default_ansicht === 'alles' ? 'alles' : 'packliste')
    }

    if (fields.length === 0) return getVacation(db, id)

    values.push(id)
    const query = `UPDATE urlaube SET ${fields.join(', ')} WHERE id = ?`
    await db.prepare(query).bind(...values).run()

    return getVacation(db, id)
  } catch (error) {
    console.error('Error updating vacation:', error)
    return null
  }
}

/***
 * Löschen einer Urlaubsreise
 */
export async function deleteVacation(db: D1Database, id: string): Promise<boolean> {
  try {
    // Zuerst alle Packlisten-Einträge löschen
    const packlisten = await db.prepare('SELECT id FROM packlisten WHERE urlaub_id = ?').bind(id).all()
    for (const packliste of packlisten.results || []) {
      await db.prepare('DELETE FROM packlisten_eintraege WHERE packliste_id = ?').bind(packliste.id).run()
    }

    // Dann die Packlisten löschen
    await db.prepare('DELETE FROM packlisten WHERE urlaub_id = ?').bind(id).run()

    // Schließlich den Urlaub löschen
    await db.prepare('DELETE FROM urlaube WHERE id = ?').bind(id).run()

    return true
  } catch (error) {
    console.error('Error deleting vacation:', error)
    return false
  }
}

/**
 * Abrufen aller Packartikel für eine Urlaubsreise
 * Batch-Loading für Mitreisende via Subquery (nur 1 Parameter – D1-Limit 100)
 */
export async function getPackingItems(db: D1Database, vacationId: string): Promise<PackingItem[]> {
  try {
    const query = `
      SELECT 
        pe.id, pe.packliste_id, pe.gegenstand_id, pe.anzahl, pe.gepackt, pe.gepackt_vorgemerkt, pe.gepackt_vorgemerkt_durch, pe.bemerkung, pe.transport_id,
        ag.was, ag.einzelgewicht, ag.details, ag.mitreisenden_typ, ag.status AS status, ag.erst_abreisetag_gepackt as erst_abreisetag_gepackt,
        k.titel as kategorie,
        hk.titel as hauptkategorie,
        hk.reihenfolge as hk_reihenfolge,
        k.reihenfolge as k_reihenfolge,
        t.name as transport_name,
        pe.created_at
      FROM packlisten_eintraege pe
      JOIN packlisten p ON pe.packliste_id = p.id
      JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN transportmittel t ON pe.transport_id = t.id
      WHERE p.urlaub_id = ?
        AND ag.status NOT IN ('Ausgemustert', 'Fest Installiert')
      ORDER BY hk.reihenfolge, k.reihenfolge, ag.was
    `
    const result = await db.prepare(query).bind(vacationId).all<Record<string, unknown>>()
    const rows = result.results || []

    // Batch: alle Mitreisende für diese Urlaubs-Packliste in einer Query (Subquery, kein IN mit vielen IDs)
    const mitQuery = `
      SELECT pem.packlisten_eintrag_id, pem.mitreisender_id, m.name as mitreisender_name, pem.gepackt, pem.gepackt_vorgemerkt, pem.anzahl, pem.transport_id as pem_transport_id, t.name as pem_transport_name
      FROM packlisten_eintrag_mitreisende pem
      JOIN mitreisende m ON pem.mitreisender_id = m.id
      LEFT JOIN transportmittel t ON pem.transport_id = t.id
      WHERE pem.packlisten_eintrag_id IN (
        SELECT pe.id FROM packlisten_eintraege pe
        JOIN packlisten p ON pe.packliste_id = p.id
        WHERE p.urlaub_id = ?
      )
      ORDER BY pem.packlisten_eintrag_id, m.name
    `
    const mitResult = await db.prepare(mitQuery).bind(vacationId).all<{
      packlisten_eintrag_id: string
      mitreisender_id: string
      mitreisender_name: string
      gepackt: number
      gepackt_vorgemerkt?: number
      anzahl?: number | null
      pem_transport_id?: string | null
      pem_transport_name?: string | null
    }>()
    const mitRows = mitResult.results || []
    const mitreisendeByEintrag = new Map<string, Array<{ mitreisender_id: string; mitreisender_name: string; gepackt: boolean; gepackt_vorgemerkt?: boolean; anzahl?: number; transport_id?: string | null; transport_name?: string }>>()
    for (const m of mitRows) {
      const eid = String(m.packlisten_eintrag_id)
      const arr = mitreisendeByEintrag.get(eid) || []
      arr.push({
        mitreisender_id: String(m.mitreisender_id),
        mitreisender_name: String(m.mitreisender_name),
        gepackt: !!m.gepackt,
        gepackt_vorgemerkt: !!m.gepackt_vorgemerkt,
        anzahl: m.anzahl != null ? Number(m.anzahl) : undefined,
        transport_id: m.pem_transport_id != null ? String(m.pem_transport_id) : undefined,
        transport_name: m.pem_transport_name != null ? String(m.pem_transport_name) : undefined,
      })
      mitreisendeByEintrag.set(eid, arr)
    }

    const items: PackingItem[] = []
    for (const item of rows) {
      const id = String(item.id)
      const mitreisende = mitreisendeByEintrag.get(id) || []

      items.push({
        id,
        packliste_id: String(item.packliste_id),
        gegenstand_id: String(item.gegenstand_id),
        anzahl: Number(item.anzahl),
        gepackt: !!item.gepackt,
        gepackt_vorgemerkt: !!((item as Record<string, unknown>).gepackt_vorgemerkt),
        gepackt_vorgemerkt_durch: (item as Record<string, unknown>).gepackt_vorgemerkt_durch as string | null | undefined,
        bemerkung: item.bemerkung ? String(item.bemerkung) : null,
        transport_id: item.transport_id ? String(item.transport_id) : undefined,
        transport_name: item.transport_name ? String(item.transport_name) : undefined,
        mitreisenden_typ: String(item.mitreisenden_typ || 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte',
        mitreisende,
        was: String(item.was),
        kategorie: String(item.kategorie),
        hauptkategorie: String(item.hauptkategorie),
        details: item.details ? String(item.details) : undefined,
        einzelgewicht: item.einzelgewicht ? Number(item.einzelgewicht) : undefined,
        status: (() => {
          const raw = (item as Record<string, unknown>).status ?? (item as Record<string, unknown>)['ag.status']
          const s = raw != null ? String(raw).trim() : ''
          return s === 'Immer gepackt' ? 'Immer gepackt' : (s || 'Normal')
        })(),
        erst_abreisetag_gepackt: !!((item as Record<string, unknown>).erst_abreisetag_gepackt ?? (item as Record<string, unknown>)['ag.erst_abreisetag_gepackt']),
        created_at: String(item.created_at || ''),
        orderHk: item.hk_reihenfolge != null ? Number(item.hk_reihenfolge) : undefined,
        orderK: item.k_reihenfolge != null ? Number(item.k_reihenfolge) : undefined,
      })
    }

    // Temporäre Einträge (nur diese Packliste, nicht in Ausrüstung)
    const packlisteIdResult = await db.prepare('SELECT id FROM packlisten WHERE urlaub_id = ?').bind(vacationId).first<{ id: string }>()
    const packlisteId = packlisteIdResult?.id
    if (packlisteId) {
      // Mitreisende für temporäre Einträge laden (separate Tabelle)
      const tempMitQuery = `
        SELECT pem.packlisten_eintrag_id, pem.mitreisender_id, m.name as mitreisender_name, pem.gepackt, pem.gepackt_vorgemerkt, pem.anzahl, pem.transport_id as pem_transport_id, t.name as pem_transport_name
        FROM packlisten_eintrag_mitreisende_temporaer pem
        JOIN mitreisende m ON pem.mitreisender_id = m.id
        LEFT JOIN transportmittel t ON pem.transport_id = t.id
        WHERE pem.packlisten_eintrag_id IN (
          SELECT pet.id FROM packlisten_eintraege_temporaer pet
          WHERE pet.packliste_id = ?
        )
        ORDER BY pem.packlisten_eintrag_id, m.name
      `
      const tempMitResult = await db.prepare(tempMitQuery).bind(packlisteId).all<{
        packlisten_eintrag_id: string
        mitreisender_id: string
        mitreisender_name: string
        gepackt: number
        gepackt_vorgemerkt?: number
        anzahl?: number | null
        pem_transport_id?: string | null
        pem_transport_name?: string | null
      }>()
      const tempMitRows = tempMitResult.results || []
      const tempMitreisendeByEintrag = new Map<
        string,
        Array<{
          mitreisender_id: string
          mitreisender_name: string
          gepackt: boolean
          gepackt_vorgemerkt?: boolean
          anzahl?: number
          transport_id?: string | null
          transport_name?: string
        }>
      >()
      for (const m of tempMitRows) {
        const eid = String(m.packlisten_eintrag_id)
        const arr = tempMitreisendeByEintrag.get(eid) || []
        arr.push({
          mitreisender_id: String(m.mitreisender_id),
          mitreisender_name: String(m.mitreisender_name),
          gepackt: !!m.gepackt,
          gepackt_vorgemerkt: !!m.gepackt_vorgemerkt,
          anzahl: m.anzahl != null ? Number(m.anzahl) : undefined,
          transport_id: m.pem_transport_id != null ? String(m.pem_transport_id) : undefined,
          transport_name: m.pem_transport_name != null ? String(m.pem_transport_name) : undefined,
        })
        tempMitreisendeByEintrag.set(eid, arr)
      }

      const tempQuery = `
        SELECT pet.id, pet.packliste_id, pet.was, pet.kategorie_id, pet.anzahl, pet.gepackt, pet.gepackt_vorgemerkt, pet.gepackt_vorgemerkt_durch, pet.bemerkung, pet.transport_id,
               k.titel as kategorie, hk.titel as hauptkategorie, hk.reihenfolge as hk_reihenfolge, k.reihenfolge as k_reihenfolge,
               t.name as transport_name, pet.created_at
        FROM packlisten_eintraege_temporaer pet
        JOIN kategorien k ON pet.kategorie_id = k.id
        JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
        LEFT JOIN transportmittel t ON pet.transport_id = t.id
        WHERE pet.packliste_id = ?
        ORDER BY hk.reihenfolge, k.reihenfolge, pet.was
      `
      const tempResult = await db.prepare(tempQuery).bind(packlisteId).all<Record<string, unknown>>()
      const tempRows = tempResult.results || []
      for (const row of tempRows) {
        const eid = String(row.id)
        const tempMit = tempMitreisendeByEintrag.get(eid) || []
        items.push({
          id: eid,
          packliste_id: String(row.packliste_id),
          gegenstand_id: '',
          anzahl: Number(row.anzahl),
          gepackt: !!row.gepackt,
          gepackt_vorgemerkt: !!((row as Record<string, unknown>).gepackt_vorgemerkt),
          gepackt_vorgemerkt_durch: (row as Record<string, unknown>).gepackt_vorgemerkt_durch as string | null | undefined,
          bemerkung: row.bemerkung ? String(row.bemerkung) : null,
          transport_id: row.transport_id ? String(row.transport_id) : undefined,
          transport_name: row.transport_name ? String(row.transport_name) : undefined,
          mitreisenden_typ: tempMit.length > 0 ? 'ausgewaehlte' : 'pauschal',
          mitreisende: tempMit,
          was: String(row.was),
          kategorie_id: row.kategorie_id != null ? String(row.kategorie_id) : undefined,
          kategorie: String(row.kategorie),
          hauptkategorie: String(row.hauptkategorie),
          created_at: String(row.created_at || ''),
          is_temporaer: true,
          orderHk: row.hk_reihenfolge != null ? Number(row.hk_reihenfolge) : undefined,
          orderK: row.k_reihenfolge != null ? Number(row.k_reihenfolge) : undefined,
        })
      }
    }

    items.sort((a, b) => {
      const hkA = a.orderHk ?? 999
      const hkB = b.orderHk ?? 999
      if (hkA !== hkB) return hkA - hkB
      const kA = a.orderK ?? 999
      const kB = b.orderK ?? 999
      if (kA !== kB) return kA - kB
      return a.was.localeCompare(b.was)
    })

    return items
  } catch (error) {
    console.error('Error fetching packing items:', error)
    return []
  }
}

/**
 * Vorgemerk-Status eines Pauschal-Eintrags (für Kind-Berechtigung: nur eigene Vormerkung entfernen)
 */
export async function getPackingItemPauschalVorgemerkt(
  db: D1Database,
  id: string
): Promise<{ gepackt_vorgemerkt: boolean; gepackt_vorgemerkt_durch: string | null } | null> {
  let row = await db
    .prepare('SELECT gepackt_vorgemerkt, gepackt_vorgemerkt_durch FROM packlisten_eintraege WHERE id = ?')
    .bind(id)
    .first<{ gepackt_vorgemerkt: number; gepackt_vorgemerkt_durch: string | null }>()
  if (!row) {
    row = await db
      .prepare('SELECT gepackt_vorgemerkt, gepackt_vorgemerkt_durch FROM packlisten_eintraege_temporaer WHERE id = ?')
      .bind(id)
      .first<{ gepackt_vorgemerkt: number; gepackt_vorgemerkt_durch: string | null }>()
  }
  if (!row) return null
  return {
    gepackt_vorgemerkt: !!row.gepackt_vorgemerkt,
    gepackt_vorgemerkt_durch: row.gepackt_vorgemerkt_durch,
  }
}

/**
 * Aktualisieren eines Packartikels
 */
export async function updatePackingItem(
  db: D1Database,
  id: string,
  updates: {
    gepackt?: boolean
    gepackt_vorgemerkt?: boolean
    gepackt_vorgemerkt_durch?: string | null
    anzahl?: number
    bemerkung?: string | null
    transport_id?: string | null
    /** Nur für `packlisten_eintraege_temporaer` (Freitext-Bezeichnung). */
    was?: string | null
    /** Nur für temporäre Einträge. */
    kategorie_id?: string | null
  }
): Promise<boolean> {
  try {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (updates.gepackt !== undefined) {
      fields.push('gepackt = ?')
      values.push(updates.gepackt ? 1 : 0)
    }
    if (updates.gepackt_vorgemerkt !== undefined) {
      fields.push('gepackt_vorgemerkt = ?')
      values.push(updates.gepackt_vorgemerkt ? 1 : 0)
    }
    if (updates.gepackt_vorgemerkt_durch !== undefined) {
      fields.push('gepackt_vorgemerkt_durch = ?')
      values.push(updates.gepackt_vorgemerkt_durch || null)
    }
    if (updates.anzahl !== undefined) {
      fields.push('anzahl = ?')
      values.push(updates.anzahl)
    }
    if (updates.bemerkung !== undefined) {
      fields.push('bemerkung = ?')
      values.push(updates.bemerkung || '')
    }
    if (updates.transport_id !== undefined) {
      fields.push('transport_id = ?')
      values.push(updates.transport_id || null)
    }

    if (fields.length > 0) {
      values.push(id)
      const query = `UPDATE packlisten_eintraege SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
      const r = await db.prepare(query).bind(...values).run()
      if (r.meta.changes > 0) return true
    }

    // Temporärer Eintrag: gleiche Felder (gepackt, gepackt_vorgemerkt, anzahl, bemerkung, transport_id) plus was
    const tempFields: string[] = []
    const tempValues: (string | number | null)[] = []
    if (updates.gepackt !== undefined) {
      tempFields.push('gepackt = ?')
      tempValues.push(updates.gepackt ? 1 : 0)
    }
    if (updates.gepackt_vorgemerkt !== undefined) {
      tempFields.push('gepackt_vorgemerkt = ?')
      tempValues.push(updates.gepackt_vorgemerkt ? 1 : 0)
    }
    if (updates.gepackt_vorgemerkt_durch !== undefined) {
      tempFields.push('gepackt_vorgemerkt_durch = ?')
      tempValues.push(updates.gepackt_vorgemerkt_durch || null)
    }
    if (updates.anzahl !== undefined) {
      tempFields.push('anzahl = ?')
      tempValues.push(updates.anzahl)
    }
    if (updates.bemerkung !== undefined) {
      tempFields.push('bemerkung = ?')
      tempValues.push(updates.bemerkung || '')
    }
    if (updates.transport_id !== undefined) {
      tempFields.push('transport_id = ?')
      tempValues.push(updates.transport_id || null)
    }
    if (updates.was !== undefined) {
      tempFields.push('was = ?')
      tempValues.push(updates.was?.trim() ?? '')
    }
    if (updates.kategorie_id !== undefined) {
      tempFields.push('kategorie_id = ?')
      tempValues.push(updates.kategorie_id || null)
    }
    if (tempFields.length === 0) return true
    tempValues.push(id)
    const tempQuery = `UPDATE packlisten_eintraege_temporaer SET ${tempFields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    await db.prepare(tempQuery).bind(...tempValues).run()
    return true
  } catch (error) {
    console.error('Error updating packing item:', error)
    return false
  }
}

/**
 * Abrufen aller Ausrüstungsgegenstände
 * Batch-Loading für Links, Standard-Mitreisende (kein N+1)
 */
export async function getEquipmentItems(db: D1Database): Promise<EquipmentItem[]> {
  try {
    const query = `
      SELECT 
        ag.*, 
        k.titel as kategorie_titel,
        hk.titel as hauptkategorie_titel,
        t.name as transport_name
      FROM ausruestungsgegenstaende ag
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN transportmittel t ON ag.transport_id = t.id
      ORDER BY hk.reihenfolge, k.reihenfolge, ag.was
    `
    const itemsResult = await db.prepare(query).all<Record<string, unknown>>()
    const rows = itemsResult.results || []

    // Batch: Alle Links und Standard-Mitreisende in je einer Query laden
    const linksResult = await db
      .prepare('SELECT * FROM ausruestungsgegenstaende_links')
      .all<EquipmentLink>()
    const allLinks = linksResult.results || []
    const linksByGegenstand = new Map<string, EquipmentLink[]>()
    for (const link of allLinks) {
      const gid = String(link.gegenstand_id)
      const existing = linksByGegenstand.get(gid) || []
      existing.push(link)
      linksByGegenstand.set(gid, existing)
    }

    const smResult = await db
      .prepare('SELECT gegenstand_id, mitreisender_id FROM ausruestungsgegenstaende_standard_mitreisende')
      .all<{ gegenstand_id: string; mitreisender_id: string }>()
    const allSm = smResult.results || []
    const smByGegenstand = new Map<string, string[]>()
    for (const row of allSm) {
      const gid = String(row.gegenstand_id)
      const existing = smByGegenstand.get(gid) || []
      existing.push(String(row.mitreisender_id))
      smByGegenstand.set(gid, existing)
    }

    const items: EquipmentItem[] = []
    for (const row of rows) {
      const id = String(row.id)
      const links = linksByGegenstand.get(id) || []
      const standard_mitreisende = smByGegenstand.get(id) || []

      items.push({
        id,
        was: String(row.was),
        kategorie_id: String(row.kategorie_id),
        kategorie_titel: row.kategorie_titel ? String(row.kategorie_titel) : undefined,
        hauptkategorie_titel: row.hauptkategorie_titel ? String(row.hauptkategorie_titel) : undefined,
        transport_id: row.transport_id ? String(row.transport_id) : null,
        transport_name: row.transport_name ? String(row.transport_name) : undefined,
        einzelgewicht: row.einzelgewicht != null ? Number(row.einzelgewicht) : 0,
        standard_anzahl: row.standard_anzahl != null ? Number(row.standard_anzahl) : 1,
        status: String(row.status || 'Normal'),
        details: row.details ? String(row.details) : '',
        is_standard: !!row.is_standard,
        erst_abreisetag_gepackt: !!row.erst_abreisetag_gepackt,
        mitreisenden_typ: String(row.mitreisenden_typ || 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte',
        standard_mitreisende,
        in_pauschale_inbegriffen: !!(row.in_pauschale_inbegriffen ?? 0),
        mengenregel: parseRegel(row.mengenregel as string | null | undefined),
        tags: [],
        links,
        created_at: String(row.created_at || ''),
      })
    }
    return items
  } catch (error) {
    console.error('Error fetching equipment items:', error)
    return []
  }
}

/**
 * Abrufen eines einzelnen Ausrüstungsgegenstands
 */
export async function getEquipmentItem(db: D1Database, id: string): Promise<EquipmentItem | null> {
  try {
    const query = `
      SELECT 
        ag.*, 
        k.titel as kategorie_titel,
        hk.titel as hauptkategorie_titel,
        t.name as transport_name
      FROM ausruestungsgegenstaende ag
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN transportmittel t ON ag.transport_id = t.id
      WHERE ag.id = ?
    `
    const item = await db.prepare(query).bind(id).first<EquipmentItem & { mengenregel?: string | null }>()
    if (!item) return null
    
    // Fetch links for this equipment item
    const links = await db.prepare(
      'SELECT * FROM ausruestungsgegenstaende_links WHERE gegenstand_id = ?'
    ).bind(id).all<EquipmentLink>()
    
    // Fetch standard mitreisende for this equipment item
    const standardMitreisende = await db.prepare(
      'SELECT mitreisender_id FROM ausruestungsgegenstaende_standard_mitreisende WHERE gegenstand_id = ?'
    ).bind(id).all<{ mitreisender_id: string }>()
    
    return {
      ...item,
      in_pauschale_inbegriffen: !!(item.in_pauschale_inbegriffen ?? 0),
      mengenregel: parseRegel(item.mengenregel as string | null | undefined),
      links: links.results || [],
      standard_mitreisende: standardMitreisende.results?.map((m) => m.mitreisender_id) || []
    }
  } catch (error) {
    console.error('Error fetching equipment item:', error)
    return null
  }
}

/**
 * Erstellen eines neuen Ausrüstungsgegenstands
 */
export async function createEquipmentItem(
  db: D1Database,
  item: {
    was: string
    kategorie_id: string
    transport_id?: string | null
    einzelgewicht?: number
    standard_anzahl?: number
    status?: string
    details?: string
    is_standard?: boolean
    erst_abreisetag_gepackt?: boolean
    mitreisenden_typ?: 'pauschal' | 'alle' | 'ausgewaehlte'
    standard_mitreisende?: string[]
    in_pauschale_inbegriffen?: boolean
    mengenregel?: MengenRegel | null
    tags?: string[]
    links?: string[]
  }
): Promise<EquipmentItem | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO ausruestungsgegenstaende 
         (id, was, kategorie_id, transport_id, einzelgewicht, standard_anzahl, status, details, is_standard, erst_abreisetag_gepackt, mitreisenden_typ, in_pauschale_inbegriffen, mengenregel) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        item.was,
        item.kategorie_id,
        item.transport_id || null,
        item.einzelgewicht || 0,
        item.standard_anzahl || 1,
        item.status || 'Normal',
        item.details || '',
        item.is_standard ? 1 : 0,
        item.erst_abreisetag_gepackt ? 1 : 0,
        item.mitreisenden_typ || 'pauschal',
        item.in_pauschale_inbegriffen ? 1 : 0,
        serializeRegel(item.mengenregel)
      )
      .run()

    // Insert links if provided
    if (item.links && item.links.length > 0) {
      for (const url of item.links) {
        const linkId = crypto.randomUUID()
        await db.prepare(
          'INSERT INTO ausruestungsgegenstaende_links (id, gegenstand_id, url) VALUES (?, ?, ?)'
        ).bind(linkId, id, url).run()
      }
    }

    // Insert standard mitreisende if provided
    if (item.standard_mitreisende && item.standard_mitreisende.length > 0) {
      for (const mitreisenderId of item.standard_mitreisende) {
        await db.prepare(
          'INSERT INTO ausruestungsgegenstaende_standard_mitreisende (gegenstand_id, mitreisender_id) VALUES (?, ?)'
        ).bind(id, mitreisenderId).run()
      }
    }

    // Insert tags if provided
    if (item.tags && item.tags.length > 0) {
      await setTagsForEquipment(db, id, item.tags)
    }

    return getEquipmentItem(db, id)
  } catch (error) {
    console.error('Error creating equipment item:', error)
    return null
  }
}

/**
 * Aktualisieren eines Ausrüstungsgegenstands
 */
export async function updateEquipmentItem(
  db: D1Database,
  id: string,
  updates: {
    was?: string
    kategorie_id?: string
    transport_id?: string | null
    einzelgewicht?: number
    standard_anzahl?: number
    status?: string
    details?: string
    is_standard?: boolean
    erst_abreisetag_gepackt?: boolean
    mitreisenden_typ?: 'pauschal' | 'alle' | 'ausgewaehlte'
    standard_mitreisende?: string[]
    in_pauschale_inbegriffen?: boolean
    mengenregel?: MengenRegel | null
    tags?: string[]
    links?: string[]
  }
): Promise<EquipmentItem | null> {
  try {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (updates.was !== undefined) {
      fields.push('was = ?')
      values.push(updates.was)
    }
    if (updates.kategorie_id !== undefined) {
      fields.push('kategorie_id = ?')
      values.push(updates.kategorie_id)
    }
    if (updates.transport_id !== undefined) {
      fields.push('transport_id = ?')
      values.push(updates.transport_id)
    }
    if (updates.einzelgewicht !== undefined) {
      fields.push('einzelgewicht = ?')
      values.push(updates.einzelgewicht)
    }
    if (updates.standard_anzahl !== undefined) {
      fields.push('standard_anzahl = ?')
      values.push(updates.standard_anzahl)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.details !== undefined) {
      fields.push('details = ?')
      values.push(updates.details)
    }
    if (updates.mitreisenden_typ !== undefined) {
      fields.push('mitreisenden_typ = ?')
      values.push(updates.mitreisenden_typ)
    }
    if (updates.is_standard !== undefined) {
      fields.push('is_standard = ?')
      values.push(updates.is_standard ? 1 : 0)
    }
    if (updates.erst_abreisetag_gepackt !== undefined) {
      fields.push('erst_abreisetag_gepackt = ?')
      values.push(updates.erst_abreisetag_gepackt ? 1 : 0)
    }
    if (updates.in_pauschale_inbegriffen !== undefined) {
      fields.push('in_pauschale_inbegriffen = ?')
      values.push(updates.in_pauschale_inbegriffen ? 1 : 0)
    }
    if (updates.mengenregel !== undefined) {
      fields.push('mengenregel = ?')
      values.push(serializeRegel(updates.mengenregel))
    }

    if (fields.length > 0) {
      values.push(id)
      const query = `UPDATE ausruestungsgegenstaende SET ${fields.join(', ')} WHERE id = ?`
      await db.prepare(query).bind(...values).run()
    }

    // Update links if provided
    if (updates.links !== undefined) {
      // Delete existing links
      await db.prepare('DELETE FROM ausruestungsgegenstaende_links WHERE gegenstand_id = ?').bind(id).run()
      
      // Insert new links
      if (updates.links.length > 0) {
        for (const url of updates.links) {
          const linkId = crypto.randomUUID()
          await db.prepare(
            'INSERT INTO ausruestungsgegenstaende_links (id, gegenstand_id, url) VALUES (?, ?, ?)'
          ).bind(linkId, id, url).run()
        }
      }
    }

    // Update standard mitreisende if provided
    if (updates.standard_mitreisende !== undefined) {
      // Delete existing standard mitreisende
      await db.prepare('DELETE FROM ausruestungsgegenstaende_standard_mitreisende WHERE gegenstand_id = ?').bind(id).run()
      
      // Insert new standard mitreisende
      if (updates.standard_mitreisende.length > 0) {
        for (const mitreisenderId of updates.standard_mitreisende) {
          await db.prepare(
            'INSERT INTO ausruestungsgegenstaende_standard_mitreisende (gegenstand_id, mitreisender_id) VALUES (?, ?)'
          ).bind(id, mitreisenderId).run()
        }
      }
    }

    // Update tags if provided
    if (updates.tags !== undefined) {
      await setTagsForEquipment(db, id, updates.tags)
    }

    return getEquipmentItem(db, id)
  } catch (error) {
    console.error('Error updating equipment item:', error)
    return null
  }
}

/**
 * Löschen eines Ausrüstungsgegenstands
 */
export async function deleteEquipmentItem(db: D1Database, id: string): Promise<boolean> {
  try {
    // Zuerst alle Packlisten-Einträge für diesen Gegenstand löschen
    await db.prepare('DELETE FROM packlisten_eintraege WHERE gegenstand_id = ?').bind(id).run()

    // Dann den Gegenstand selbst löschen
    await db.prepare('DELETE FROM ausruestungsgegenstaende WHERE id = ?').bind(id).run()

    return true
  } catch (error) {
    console.error('Error deleting equipment item:', error)
    return false
  }
}

/**
 * Abrufen aller Hauptkategorien
 */
export async function getMainCategories(db: D1Database): Promise<MainCategory[]> {
  try {
    const result = await db
      .prepare(
        'SELECT id, titel, reihenfolge, pauschalgewicht, pauschal_pro_person, pauschal_transport_id FROM hauptkategorien ORDER BY reihenfolge'
      )
      .all<MainCategory & { pauschal_pro_person?: number }>()
    return (result.results || []).map((r) => ({
      id: r.id,
      titel: r.titel,
      reihenfolge: r.reihenfolge,
      pauschalgewicht: r.pauschalgewicht,
      pauschal_pro_person: !!(r.pauschal_pro_person ?? 0),
      pauschal_transport_id: r.pauschal_transport_id ?? null
    }))
  } catch (error) {
    console.error('Error fetching main categories:', error)
    return []
  }
}

/**
 * Abrufen aller Kategorien mit ihren Hauptkategorien
 */
export async function getCategoriesWithMainCategories(db: D1Database): Promise<Array<Category & { hauptkategorie_titel: string }>> {
  try {
    const query = `
      SELECT 
        k.id, k.titel, k.hauptkategorie_id, k.reihenfolge,
        k.pauschalgewicht, k.pauschal_pro_person, k.pauschal_transport_id,
        hk.titel as hauptkategorie_titel
      FROM kategorien k
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      ORDER BY hk.reihenfolge, k.reihenfolge
    `
    const result = await db.prepare(query).all<Category & { hauptkategorie_titel: string; pauschal_pro_person?: number }>()
    return (result.results || []).map((r) => ({
      ...r,
      pauschal_pro_person: !!(r.pauschal_pro_person ?? 0)
    }))
  } catch (error) {
    console.error('Error fetching categories with main categories:', error)
    return []
  }
}

/**
 * Abrufen aller Transportmittel
 */
interface TransportVehicleRow {
  id: string
  name: string
  zul_gesamtgewicht: number
  eigengewicht: number
  fest_installiert_mitrechnen?: number
  created_at: string
}

export async function getTransportVehicles(db: D1Database): Promise<TransportVehicle[]> {
  try {
    const result = await db.prepare('SELECT * FROM transportmittel ORDER BY name').all<TransportVehicleRow>()
    return (result.results || []).map((row) => ({
      id: row.id,
      name: row.name,
      zul_gesamtgewicht: row.zul_gesamtgewicht,
      eigengewicht: row.eigengewicht,
      fest_installiert_mitrechnen: !!(row.fest_installiert_mitrechnen ?? 0),
      created_at: row.created_at
    }))
  } catch (error) {
    console.error('Error fetching transport vehicles:', error)
    return []
  }
}

/**
 * Erstellen eines neuen Transportmittels
 */
export async function createTransportVehicle(
  db: D1Database,
  name: string,
  zulGesamtgewicht: number,
  eigengewicht: number,
  festInstalliertMitrechnen: boolean = false
): Promise<string | null> {
  const id = crypto.randomUUID()
  try {
    await db
      .prepare(
        'INSERT INTO transportmittel (id, name, zul_gesamtgewicht, eigengewicht, fest_installiert_mitrechnen) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, name, zulGesamtgewicht, eigengewicht, festInstalliertMitrechnen ? 1 : 0)
      .run()
    return id
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('fest_installiert_mitrechnen') || errMsg.includes('no such column')) {
      try {
        await db
          .prepare(
            'INSERT INTO transportmittel (id, name, zul_gesamtgewicht, eigengewicht) VALUES (?, ?, ?, ?)'
          )
          .bind(id, name, zulGesamtgewicht, eigengewicht)
          .run()
        return id
      } catch (fallbackError) {
        console.error('Error creating transport vehicle (fallback):', fallbackError)
        return null
      }
    }
    console.error('Error creating transport vehicle:', error)
    return null
  }
}

/**
 * Aktualisieren eines Transportmittels
 * Versucht zuerst UPDATE mit fest_installiert_mitrechnen (nach Migration 0006).
 * Falls die Spalte noch nicht existiert, Fallback auf UPDATE ohne diese Spalte.
 */
export async function updateTransportVehicle(
  db: D1Database,
  id: string,
  name: string,
  zulGesamtgewicht: number,
  eigengewicht: number,
  festInstalliertMitrechnen?: boolean
): Promise<boolean> {
  const fim = festInstalliertMitrechnen ?? false
  try {
    await db
      .prepare(
        'UPDATE transportmittel SET name = ?, zul_gesamtgewicht = ?, eigengewicht = ?, fest_installiert_mitrechnen = ? WHERE id = ?'
      )
      .bind(name, zulGesamtgewicht, eigengewicht, fim ? 1 : 0, id)
      .run()
    return true
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    if (errMsg.includes('fest_installiert_mitrechnen') || errMsg.includes('no such column')) {
      try {
        await db
          .prepare(
            'UPDATE transportmittel SET name = ?, zul_gesamtgewicht = ?, eigengewicht = ? WHERE id = ?'
          )
          .bind(name, zulGesamtgewicht, eigengewicht, id)
          .run()
        return true
      } catch (fallbackError) {
        console.error('Error updating transport vehicle (fallback):', fallbackError)
        return false
      }
    }
    console.error('Error updating transport vehicle:', error)
    return false
  }
}

/**
 * Löschen eines Transportmittels
 */
export async function deleteTransportVehicle(db: D1Database, id: string): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM transportmittel WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting transport vehicle:', error)
    return false
  }
}

/**
 * Abrufen der manuellen Festgewicht-Einträge eines Transportmittels
 */
export async function getTransportVehicleFestgewichtManuell(
  db: D1Database,
  transportId: string
): Promise<TransportVehicleFestgewichtManuell[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM transportmittel_festgewicht_manuell WHERE transport_id = ? ORDER BY titel')
      .bind(transportId)
      .all<TransportVehicleFestgewichtManuell>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching transport vehicle festgewicht manuell:', error)
    return []
  }
}

/**
 * Erstellen eines manuellen Festgewicht-Eintrags
 */
export async function createTransportVehicleFestgewichtManuell(
  db: D1Database,
  transportId: string,
  titel: string,
  gewicht: number
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO transportmittel_festgewicht_manuell (id, transport_id, titel, gewicht) VALUES (?, ?, ?, ?)'
      )
      .bind(id, transportId, titel, gewicht)
      .run()
    return id
  } catch (error) {
    console.error('Error creating transport vehicle festgewicht manuell:', error)
    return null
  }
}

/**
 * Aktualisieren eines manuellen Festgewicht-Eintrags
 */
export async function updateTransportVehicleFestgewichtManuell(
  db: D1Database,
  id: string,
  titel: string,
  gewicht: number
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE transportmittel_festgewicht_manuell SET titel = ?, gewicht = ? WHERE id = ?')
      .bind(titel, gewicht, id)
      .run()
    return true
  } catch (error) {
    console.error('Error updating transport vehicle festgewicht manuell:', error)
    return false
  }
}

/**
 * Löschen eines manuellen Festgewicht-Eintrags
 */
export async function deleteTransportVehicleFestgewichtManuell(
  db: D1Database,
  id: string
): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM transportmittel_festgewicht_manuell WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting transport vehicle festgewicht manuell:', error)
    return false
  }
}

/**
 * Abrufen der Ausrüstungsgegenstände mit Status "Fest Installiert" für ein Transportmittel.
 * Gesamtgewicht = einzelgewicht × standard_anzahl pro Position.
 */
export async function getEquipmentItemsFestInstalliertByTransport(
  db: D1Database,
  transportId: string
): Promise<Array<{ id: string; was: string; einzelgewicht: number; standard_anzahl: number; gesamtgewicht: number }>> {
  try {
    const result = await db
      .prepare(
        `SELECT id, was, COALESCE(einzelgewicht, 0) as einzelgewicht, COALESCE(standard_anzahl, 1) as standard_anzahl,
                (COALESCE(einzelgewicht, 0) * COALESCE(standard_anzahl, 1)) as gesamtgewicht
         FROM ausruestungsgegenstaende 
         WHERE transport_id = ? AND status = 'Fest Installiert'`
      )
      .bind(transportId)
      .all<{ id: string; was: string; einzelgewicht: number; standard_anzahl: number; gesamtgewicht: number }>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching equipment items fest installiert:', error)
    return []
  }
}

/**
 * Festgewicht-Summen für ein Transportmittel (für Übersicht)
 */
export async function getTransportVehicleFestgewichtSums(
  db: D1Database,
  transportId: string
): Promise<{ manuellSum: number; equipmentSum: number; total: number }> {
  let manuellSum = 0
  let equipmentSum = 0
  try {
    const manuell = await db
      .prepare(
        'SELECT COALESCE(SUM(gewicht), 0) as s FROM transportmittel_festgewicht_manuell WHERE transport_id = ?'
      )
      .bind(transportId)
      .first<{ s: number }>()
    manuellSum = manuell?.s ?? 0
  } catch {
    // Tabelle existiert möglicherweise noch nicht
  }
  try {
    const equip = await db
      .prepare(
        `SELECT COALESCE(SUM(einzelgewicht * COALESCE(standard_anzahl, 1)), 0) as s 
         FROM ausruestungsgegenstaende 
         WHERE transport_id = ? AND status = 'Fest Installiert'`
      )
      .bind(transportId)
      .first<{ s: number }>()
    equipmentSum = equip?.s ?? 0
  } catch {
    // ignore
  }
  return { manuellSum, equipmentSum, total: manuellSum + equipmentSum }
}

export type TransportVehicleWithFestgewicht = TransportVehicle & { festgewichtTotal: number }

/**
 * Transportmittel mit Festgewicht-Gesamtsumme (für Übersicht)
 */
export async function getTransportVehiclesWithFestgewicht(
  db: D1Database
): Promise<TransportVehicleWithFestgewicht[]> {
  const vehicles = await getTransportVehicles(db)
  const result: TransportVehicleWithFestgewicht[] = []
  for (const v of vehicles) {
    const sums = await getTransportVehicleFestgewichtSums(db, v.id)
    result.push({ ...v, festgewichtTotal: sums.total })
  }
  return result
}

export interface PackStatusTransportOverview {
  transportId: string
  transportName: string
  zuladung: number
  festInstalliert: number
  beladung: number
  reserve: number
}

export interface PackStatusEntryOhneGewicht {
  id: string
  was: string
  anzahl: number
  hauptkategorie: string
  transport_id?: string | null
  transport_name?: string | null
}

export interface PackStatusProgressHauptkategorie {
  hauptkategorie: string
  gepackt: number
  gesamt: number
  prozent: number
}

export interface PackStatusData {
  transportOverview: PackStatusTransportOverview[]
  entriesOhneGewicht: PackStatusEntryOhneGewicht[]
  progressHauptkategorien: PackStatusProgressHauptkategorie[]
}

/**
 * Pack-Status für einen Urlaub: Gewichtsübersicht, Einträge ohne Gewicht, Fortschritt
 */
export async function getPackStatus(db: D1Database, vacationId: string): Promise<PackStatusData | null> {
  try {
    const packlisteResult = await db
      .prepare('SELECT id FROM packlisten WHERE urlaub_id = ?')
      .bind(vacationId)
      .first<{ id: string }>()
    const packlisteId = packlisteResult?.id
    if (!packlisteId) return null

    const transporte = await getTransportVehicles(db)

    // Festgewicht für alle Transporte in 2 Batch-Queries (statt 2*N Einzelabfragen)
    const festSums = new Map<string, { manuell: number; equipment: number }>()
    for (const t of transporte) {
      festSums.set(t.id, { manuell: 0, equipment: 0 })
    }
    const manuellAll = await db
      .prepare(
        'SELECT transport_id, COALESCE(SUM(gewicht), 0) as s FROM transportmittel_festgewicht_manuell GROUP BY transport_id'
      )
      .all<{ transport_id: string; s: number }>()
    for (const r of manuellAll.results || []) {
      const entry = festSums.get(r.transport_id)
      if (entry) entry.manuell = r.s
    }
    const equipAll = await db
      .prepare(
        `SELECT transport_id, COALESCE(SUM(einzelgewicht * COALESCE(standard_anzahl, 1)), 0) as s
         FROM ausruestungsgegenstaende WHERE status = 'Fest Installiert' AND transport_id IS NOT NULL GROUP BY transport_id`
      )
      .all<{ transport_id: string; s: number }>()
    for (const r of equipAll.results || []) {
      const entry = festSums.get(r.transport_id)
      if (entry) entry.equipment = r.s
    }

    const beladungQuery = `
      SELECT pe.transport_id,
        COALESCE(SUM(
          CASE
            WHEN ag.mitreisenden_typ = 'pauschal' THEN ag.einzelgewicht * pe.anzahl
            ELSE ag.einzelgewicht * COALESCE(pem.anzahl, pe.anzahl)
          END
        ), 0) as gewicht
      FROM packlisten_eintraege pe
      JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
      LEFT JOIN packlisten_eintrag_mitreisende pem ON pem.packlisten_eintrag_id = pe.id
      WHERE pe.packliste_id = ? AND pe.transport_id IS NOT NULL
        AND (ag.mitreisenden_typ = 'pauschal' OR pem.mitreisender_id IS NOT NULL)
      GROUP BY pe.transport_id
    `
    const beladungResult = await db
      .prepare(beladungQuery)
      .bind(packlisteId)
      .all<{ transport_id: string; gewicht: number }>()
    const beladungByTransport = new Map<string, number>()
    for (const t of transporte) {
      beladungByTransport.set(t.id, 0)
    }
    for (const r of beladungResult.results || []) {
      const cur = beladungByTransport.get(r.transport_id) ?? 0
      beladungByTransport.set(r.transport_id, cur + r.gewicht)
    }

    // Pauschalen: pro Kategorie/Hauptkategorie genau einmal, wenn mindestens ein inbegriffener Eintrag
    const mitreisendeCountResult = await db
      .prepare('SELECT COUNT(*) as c FROM urlaub_mitreisende WHERE urlaub_id = ?')
      .bind(vacationId)
      .first<{ c: number }>()
    const mitreisendeCount = mitreisendeCountResult?.c ?? 0
    const firstTransportId = transporte[0]?.id ?? null

    // Kategorien mit Pauschale: Hat mindestens ein inbegriffenes Item in der Packliste?
    const kategorienPauschalResult = await db
      .prepare(
        `SELECT k.id, k.pauschalgewicht, k.pauschal_pro_person, k.pauschal_transport_id
         FROM kategorien k
         WHERE (k.pauschalgewicht IS NOT NULL AND k.pauschalgewicht > 0)
           AND EXISTS (
             SELECT 1 FROM packlisten_eintraege pe
             JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
             WHERE pe.packliste_id = ? AND ag.kategorie_id = k.id
               AND COALESCE(ag.in_pauschale_inbegriffen, 0) = 1
           )`
      )
      .bind(packlisteId)
      .all<{ id: string; pauschalgewicht: number; pauschal_pro_person?: number; pauschal_transport_id?: string | null }>()

    for (const row of kategorienPauschalResult.results || []) {
      const gewicht =
        Number(row.pauschalgewicht) * (row.pauschal_pro_person ? mitreisendeCount : 1)
      const tid = row.pauschal_transport_id || firstTransportId
      if (tid) {
        const cur = beladungByTransport.get(tid) ?? 0
        beladungByTransport.set(tid, cur + gewicht)
      }
    }

    // Hauptkategorien mit Pauschale: Inbegriffene Items in Unterkategorien OHNE eigene Pauschale
    const hauptkategorienPauschalResult = await db
      .prepare(
        `SELECT hk.id, hk.pauschalgewicht, hk.pauschal_pro_person, hk.pauschal_transport_id
         FROM hauptkategorien hk
         WHERE (hk.pauschalgewicht IS NOT NULL AND hk.pauschalgewicht > 0)
           AND EXISTS (
             SELECT 1 FROM packlisten_eintraege pe
             JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
             JOIN kategorien k ON ag.kategorie_id = k.id
             WHERE pe.packliste_id = ? AND k.hauptkategorie_id = hk.id
               AND COALESCE(ag.in_pauschale_inbegriffen, 0) = 1
               AND (k.pauschalgewicht IS NULL OR k.pauschalgewicht = 0)
           )`
      )
      .bind(packlisteId)
      .all<{ id: string; pauschalgewicht: number; pauschal_pro_person?: number; pauschal_transport_id?: string | null }>()

    for (const row of hauptkategorienPauschalResult.results || []) {
      const gewicht =
        Number(row.pauschalgewicht) * (row.pauschal_pro_person ? mitreisendeCount : 1)
      const tid = row.pauschal_transport_id || firstTransportId
      if (tid) {
        const cur = beladungByTransport.get(tid) ?? 0
        beladungByTransport.set(tid, cur + gewicht)
      }
    }

    const transportOverview: PackStatusTransportOverview[] = transporte.map((t) => {
      const zuladung = t.zul_gesamtgewicht - t.eigengewicht
      const fest = festSums.get(t.id)
      const festInstalliert = fest ? fest.manuell + fest.equipment : 0
      const beladung = beladungByTransport.get(t.id) ?? 0
      const reserve = zuladung - festInstalliert - beladung
      return {
        transportId: t.id,
        transportName: t.name,
        zuladung,
        festInstalliert,
        beladung,
        reserve
      }
    })

    const ohneGewichtQuery = `
      SELECT pe.id, ag.was, pe.anzahl, hk.titel as hauptkategorie,
        pe.transport_id, t.name as transport_name
      FROM packlisten_eintraege pe
      JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN transportmittel t ON pe.transport_id = t.id
      WHERE pe.packliste_id = ? AND ag.status NOT IN ('Ausgemustert', 'Fest Installiert')
        AND (ag.einzelgewicht IS NULL OR ag.einzelgewicht = 0)
        AND COALESCE(ag.in_pauschale_inbegriffen, 0) = 0
      ORDER BY COALESCE(t.name, 'zzz'), hk.reihenfolge, ag.was
    `
    const ohneGewichtResult = await db
      .prepare(ohneGewichtQuery)
      .bind(packlisteId)
      .all<{ id: string; was: string; anzahl: number; hauptkategorie: string; transport_id: string | null; transport_name: string | null }>()
    const entriesOhneGewicht: PackStatusEntryOhneGewicht[] = (ohneGewichtResult.results || []).map(
      (r) => ({
        id: r.id,
        was: r.was,
        anzahl: r.anzahl,
        hauptkategorie: r.hauptkategorie,
        transport_id: r.transport_id ?? null,
        transport_name: r.transport_name ?? null
      })
    )

    const progressQuery = `
      SELECT hk.titel as hauptkategorie,
        SUM(CASE WHEN ag.mitreisenden_typ = 'pauschal' THEN 1 ELSE 0 END) +
        SUM(CASE WHEN ag.mitreisenden_typ != 'pauschal' AND pem.mitreisender_id IS NOT NULL THEN 1 ELSE 0 END) as gesamt,
        SUM(CASE WHEN ag.mitreisenden_typ = 'pauschal' AND pe.gepackt THEN 1 ELSE 0 END) +
        SUM(CASE WHEN ag.mitreisenden_typ != 'pauschal' AND pem.gepackt THEN 1 ELSE 0 END) as gepackt
      FROM packlisten_eintraege pe
      JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN packlisten_eintrag_mitreisende pem ON pem.packlisten_eintrag_id = pe.id
      WHERE pe.packliste_id = ? AND ag.status NOT IN ('Ausgemustert', 'Fest Installiert')
      GROUP BY hk.id, hk.titel, hk.reihenfolge
      ORDER BY hk.reihenfolge
    `
    const progressResult = await db
      .prepare(progressQuery)
      .bind(packlisteId)
      .all<{ hauptkategorie: string; gesamt: number; gepackt: number }>()

    const progressHauptkategorien: PackStatusProgressHauptkategorie[] = (
      progressResult.results || []
    ).map((r) => {
      const gesamt = Number(r.gesamt) || 0
      const gepackt = Number(r.gepackt) || 0
      return {
        hauptkategorie: r.hauptkategorie,
        gepackt,
        gesamt,
        prozent: gesamt > 0 ? Math.round((gepackt / gesamt) * 100) : 0
      }
    })

    return {
      transportOverview,
      entriesOhneGewicht,
      progressHauptkategorien
    }
  } catch (error) {
    console.error('Error fetching pack status:', error)
    return null
  }
}

/**
 * Eintrag in der Mitreisenden-Zuordnung für einen Packlisten-Eintrag.
 * `id` ist immer der Mitreisenden-ID; `anzahl` setzt optional einen
 * abweichenden Pro-Person-Wert (NULL → verwendet Eintrags-Gesamtanzahl).
 */
export type PackingItemMitreisenderInput = string | { id: string; anzahl?: number | null }

/**
 * Hinzufügen eines Gegenstands zur Packliste.
 *
 * Unterstützt Pro-Person-Mengen: Mitreisende können entweder als reine IDs
 * oder als `{ id, anzahl }` übergeben werden. Bei gesetzter `anzahl` wird der
 * Wert in `packlisten_eintrag_mitreisende.anzahl` hinterlegt (Migration 0003).
 */
export async function addPackingItem(
  db: D1Database,
  packlisteId: string,
  gegenstandId: string,
  anzahl: number,
  bemerkung?: string | null,
  transportId?: string | null,
  mitreisende?: PackingItemMitreisenderInput[]
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO packlisten_eintraege (id, packliste_id, gegenstand_id, anzahl, bemerkung, transport_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, packlisteId, gegenstandId, anzahl, bemerkung || null, transportId || null)
      .run()

    // Add mitreisende associations if provided
    if (mitreisende && mitreisende.length > 0) {
      for (const entry of mitreisende) {
        const mitreisenderId = typeof entry === 'string' ? entry : entry.id
        const personAnzahl = typeof entry === 'string' ? null : (entry.anzahl ?? null)
        await db
          .prepare('INSERT INTO packlisten_eintrag_mitreisende (packlisten_eintrag_id, mitreisender_id, gepackt, anzahl) VALUES (?, ?, ?, ?)')
          .bind(id, mitreisenderId, 0, personAnzahl)
          .run()
      }
    }

    return id
  } catch (error) {
    console.error('Error adding packing item:', error)
    return null
  }
}

/**
 * Temporären Packlisteneintrag hinzufügen (nur diese Packliste, nicht in Ausrüstung)
 */
export async function addTemporaryPackingItem(
  db: D1Database,
  packlisteId: string,
  was: string,
  kategorieId: string,
  anzahl: number,
  bemerkung?: string | null,
  transportId?: string | null,
  mitreisende?: string[]
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO packlisten_eintraege_temporaer (id, packliste_id, was, kategorie_id, anzahl, bemerkung, transport_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, packlisteId, was.trim(), kategorieId, anzahl, bemerkung || null, transportId || null)
      .run()
    // optionale Mitreisende-Zuordnung für temporäre Einträge
    if (mitreisende && mitreisende.length > 0) {
      for (const mitreisenderId of mitreisende) {
        await db
          .prepare(
            'INSERT INTO packlisten_eintrag_mitreisende_temporaer (packlisten_eintrag_id, mitreisender_id, gepackt, gepackt_vorgemerkt) VALUES (?, ?, 0, 0)'
          )
          .bind(id, mitreisenderId)
          .run()
      }
    }
    return id
  } catch (error) {
    console.error('Error adding temporary packing item:', error)
    return null
  }
}

/**
 * Löschen eines Packartikels (normal oder temporär)
 */
export async function deletePackingItem(db: D1Database, id: string): Promise<boolean> {
  try {
    const r1 = await db.prepare('DELETE FROM packlisten_eintraege WHERE id = ?').bind(id).run()
    if (r1.meta.changes && r1.meta.changes > 0) return true
    await db.prepare('DELETE FROM packlisten_eintraege_temporaer WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting packing item:', error)
    return false
  }
}

/**
 * Abrufen der Urlaubs-ID zu einem Packlisten-Eintrag (normal oder temporär)
 */
export async function getVacationIdFromPackingItem(
  db: D1Database,
  packingItemId: string
): Promise<string | null> {
  try {
    const result = await db
      .prepare(
        `SELECT p.urlaub_id FROM packlisten p
         JOIN packlisten_eintraege pe ON pe.packliste_id = p.id
         WHERE pe.id = ?`
      )
      .bind(packingItemId)
      .first<{ urlaub_id: string }>()
    if (result?.urlaub_id) return result.urlaub_id
    const tempResult = await db
      .prepare(
        `SELECT p.urlaub_id FROM packlisten p
         JOIN packlisten_eintraege_temporaer pet ON pet.packliste_id = p.id
         WHERE pet.id = ?`
      )
      .bind(packingItemId)
      .first<{ urlaub_id: string }>()
    return tempResult?.urlaub_id ?? null
  } catch (error) {
    console.error('Error fetching vacation id from packing item:', error)
    return null
  }
}

/**
 * Abrufen der Packliste-ID für einen Urlaub
 */
export async function getPacklisteId(db: D1Database, vacationId: string): Promise<string | null> {
  try {
    const result = await db.prepare('SELECT id FROM packlisten WHERE urlaub_id = ?').bind(vacationId).first<{ id: string }>()
    return result?.id || null
  } catch (error) {
    console.error('Error fetching packliste ID:', error)
    return null
  }
}

/**
 * ========================================
 * MITREISENDE (TRAVELERS) FUNCTIONS
 * ========================================
 */

/**
 * Abrufen aller Mitreisenden
 */
export async function getMitreisende(db: D1Database): Promise<Mitreisender[]> {
  try {
    const result = await db
      .prepare(`
        SELECT m.*, u.email as user_email, u.role as user_role
        FROM mitreisende m
        LEFT JOIN users u ON m.user_id = u.id
        ORDER BY m.name
      `)
      .all<Mitreisender & { user_email?: string | null; user_role?: string }>()
    return (result.results || []).map((r) => ({
      ...r,
      user_email: r.user_email ?? null,
      user_role: r.user_role as Mitreisender['user_role'] | undefined
    }))
  } catch (error) {
    console.error('Error fetching mitreisende:', error)
    return []
  }
}

/**
 * Abrufen der Mitreisenden für einen bestimmten Urlaub
 */
export async function getMitreisendeForVacation(db: D1Database, vacationId: string): Promise<Mitreisender[]> {
  try {
    // user_email/user_role per LEFT JOIN mitladen – wichtig für die Auswertung
    // von Mengenregeln (Kind-Erkennung über user_role === 'kind').
    const result = await db
      .prepare(`
        SELECT m.*, u.email as user_email, u.role as user_role
        FROM mitreisende m
        INNER JOIN urlaub_mitreisende um ON m.id = um.mitreisender_id
        LEFT JOIN users u ON m.user_id = u.id
        WHERE um.urlaub_id = ?
        ORDER BY m.name
      `)
      .bind(vacationId)
      .all<Mitreisender & { user_email?: string | null; user_role?: string }>()
    return (result.results || []).map((r) => ({
      ...r,
      user_email: r.user_email ?? null,
      user_role: r.user_role as Mitreisender['user_role'] | undefined,
    }))
  } catch (error) {
    console.error('Error fetching mitreisende for vacation:', error)
    return []
  }
}

/**
 * Erstellen eines neuen Mitreisenden
 */
export async function createMitreisender(
  db: D1Database,
  name: string,
  userId?: string | null,
  isDefaultMember: boolean = false,
  farbe?: string | null
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare('INSERT INTO mitreisende (id, name, user_id, is_default_member, farbe) VALUES (?, ?, ?, ?, ?)')
      .bind(id, name, userId || null, isDefaultMember ? 1 : 0, farbe || null)
      .run()
    return id
  } catch (error) {
    console.error('Error creating mitreisender:', error)
    return null
  }
}

/**
 * Aktualisieren eines Mitreisenden
 */
export async function updateMitreisender(
  db: D1Database,
  id: string,
  name: string,
  userId?: string | null,
  isDefaultMember?: boolean,
  farbe?: string | null
): Promise<boolean> {
  try {
    if (isDefaultMember !== undefined) {
      await db
        .prepare('UPDATE mitreisende SET name = ?, user_id = ?, is_default_member = ?, farbe = ? WHERE id = ?')
        .bind(name, userId || null, isDefaultMember ? 1 : 0, farbe ?? null, id)
        .run()
    } else {
      await db
        .prepare('UPDATE mitreisende SET name = ?, user_id = ?, farbe = ? WHERE id = ?')
        .bind(name, userId || null, farbe ?? null, id)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error updating mitreisender:', error)
    return false
  }
}

/**
 * Löschen eines Mitreisenden
 */
export async function deleteMitreisender(db: D1Database, id: string): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM mitreisende WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting mitreisender:', error)
    return false
  }
}

/**
 * Hinzufügen eines Mitreisenden zu einem Urlaub
 */
export async function addMitreisenderToVacation(
  db: D1Database,
  vacationId: string,
  mitreisenderId: string
): Promise<boolean> {
  try {
    await db
      .prepare('INSERT OR IGNORE INTO urlaub_mitreisende (urlaub_id, mitreisender_id) VALUES (?, ?)')
      .bind(vacationId, mitreisenderId)
      .run()
    return true
  } catch (error) {
    console.error('Error adding mitreisender to vacation:', error)
    return false
  }
}

/**
 * Entfernen eines Mitreisenden von einem Urlaub
 */
export async function removeMitreisenderFromVacation(
  db: D1Database,
  vacationId: string,
  mitreisenderId: string
): Promise<boolean> {
  try {
    await db
      .prepare('DELETE FROM urlaub_mitreisende WHERE urlaub_id = ? AND mitreisender_id = ?')
      .bind(vacationId, mitreisenderId)
      .run()
    return true
  } catch (error) {
    console.error('Error removing mitreisender from vacation:', error)
    return false
  }
}

/**
 * Setzen der Mitreisenden für einen Urlaub (ersetzt alle bisherigen)
 */
export async function setMitreisendeForVacation(
  db: D1Database,
  vacationId: string,
  mitreisendeIds: string[]
): Promise<boolean> {
  try {
    // Erst alle bisherigen Zuordnungen löschen
    await db.prepare('DELETE FROM urlaub_mitreisende WHERE urlaub_id = ?').bind(vacationId).run()
    
    // Dann neue Zuordnungen hinzufügen
    for (const mitreisenderId of mitreisendeIds) {
      await db
        .prepare('INSERT INTO urlaub_mitreisende (urlaub_id, mitreisender_id) VALUES (?, ?)')
        .bind(vacationId, mitreisenderId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error setting mitreisende for vacation:', error)
    return false
  }
}

/**
 * Abrufen der Standard-Mitreisenden für einen Ausrüstungsgegenstand
 */
export async function getStandardMitreisendeForEquipment(
  db: D1Database,
  gegenstandId: string
): Promise<string[]> {
  try {
    const result = await db
      .prepare('SELECT mitreisender_id FROM ausruestungsgegenstaende_standard_mitreisende WHERE gegenstand_id = ?')
      .bind(gegenstandId)
      .all<{ mitreisender_id: string }>()
    return result.results?.map(r => r.mitreisender_id) || []
  } catch (error) {
    console.error('Error fetching standard mitreisende for equipment:', error)
    return []
  }
}

/**
 * Setzen der Standard-Mitreisenden für einen Ausrüstungsgegenstand
 */
export async function setStandardMitreisendeForEquipment(
  db: D1Database,
  gegenstandId: string,
  mitreisendeIds: string[]
): Promise<boolean> {
  try {
    // Erst alle bisherigen Zuordnungen löschen
    await db
      .prepare('DELETE FROM ausruestungsgegenstaende_standard_mitreisende WHERE gegenstand_id = ?')
      .bind(gegenstandId)
      .run()
    
    // Dann neue Zuordnungen hinzufügen
    for (const mitreisenderId of mitreisendeIds) {
      await db
        .prepare('INSERT INTO ausruestungsgegenstaende_standard_mitreisende (gegenstand_id, mitreisender_id) VALUES (?, ?)')
        .bind(gegenstandId, mitreisenderId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error setting standard mitreisende for equipment:', error)
    return false
  }
}

/** True, wenn der Packlisten-Eintrag in packlisten_eintraege_temporaer liegt (Mitreisende dann in *_mitreisende_temporaer). */
export async function isTemporaryPackingEintrag(db: D1Database, packlistenEintragId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM packlisten_eintraege_temporaer WHERE id = ? LIMIT 1')
    .bind(packlistenEintragId)
    .first()
  return row != null
}

/**
 * Abhaken eines Packlisten-Eintrags für einen bestimmten Mitreisenden
 */
export async function togglePackingItemForMitreisender(
  db: D1Database,
  packlistenEintragId: string,
  mitreisenderId: string,
  gepackt: boolean,
  /**
   * Optionale pro-Person-Anzahl (z.B. aus einer Mengenregel berechnet).
   * Nur beim INSERT relevant – bei bestehenden Zuordnungen wird die Menge
   * nicht überschrieben (Gepackt-Toggle soll kein Override durchführen).
   */
  anzahl?: number | null,
): Promise<boolean> {
  try {
    const temp = await isTemporaryPackingEintrag(db, packlistenEintragId)
    const mitTable = temp ? 'packlisten_eintrag_mitreisende_temporaer' : 'packlisten_eintrag_mitreisende'

    const existing = await db
      .prepare(`SELECT gepackt FROM ${mitTable} WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`)
      .bind(packlistenEintragId, mitreisenderId)
      .first<{ gepackt: number }>()

    if (existing) {
      await db
        .prepare(
          `UPDATE ${mitTable} SET gepackt = ?, gepackt_vorgemerkt = ? WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`
        )
        .bind(gepackt ? 1 : 0, gepackt ? 0 : 0, packlistenEintragId, mitreisenderId)
        .run()
    } else if (temp) {
      await db
        .prepare(`INSERT INTO ${mitTable} (packlisten_eintrag_id, mitreisender_id, gepackt) VALUES (?, ?, ?)`)
        .bind(packlistenEintragId, mitreisenderId, gepackt ? 1 : 0)
        .run()
    } else {
      await db
        .prepare(`INSERT INTO ${mitTable} (packlisten_eintrag_id, mitreisender_id, gepackt, anzahl) VALUES (?, ?, ?, ?)`)
        .bind(packlistenEintragId, mitreisenderId, gepackt ? 1 : 0, anzahl ?? null)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error toggling packing item for mitreisender:', error)
    return false
  }
}

/**
 * Vorgemerkt setzen statt gepackt (für Kinder mit gepackt_erfordert_elternkontrolle)
 */
export async function togglePackingItemVorgemerktForMitreisender(
  db: D1Database,
  packlistenEintragId: string,
  mitreisenderId: string,
  vorgemerkt: boolean
): Promise<boolean> {
  try {
    const temp = await isTemporaryPackingEintrag(db, packlistenEintragId)
    const mitTable = temp ? 'packlisten_eintrag_mitreisende_temporaer' : 'packlisten_eintrag_mitreisende'

    const existing = await db
      .prepare(`SELECT gepackt, gepackt_vorgemerkt FROM ${mitTable} WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`)
      .bind(packlistenEintragId, mitreisenderId)
      .first<{ gepackt: number; gepackt_vorgemerkt: number }>()

    if (existing) {
      await db
        .prepare(`UPDATE ${mitTable} SET gepackt_vorgemerkt = ? WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`)
        .bind(vorgemerkt ? 1 : 0, packlistenEintragId, mitreisenderId)
        .run()
    } else {
      await db
        .prepare(
          `INSERT INTO ${mitTable} (packlisten_eintrag_id, mitreisender_id, gepackt, gepackt_vorgemerkt) VALUES (?, ?, 0, ?)`
        )
        .bind(packlistenEintragId, mitreisenderId, vorgemerkt ? 1 : 0)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error toggling vorgemerkt for mitreisender:', error)
    return false
  }
}

/**
 * Vorgemerkte Einträge bestätigen (Admin setzt gepackt=1, vorgemerkt=0)
 */
export async function confirmVorgemerktPauschal(db: D1Database, packlistenEintragId: string): Promise<boolean> {
  try {
    const r = await db
      .prepare('UPDATE packlisten_eintraege SET gepackt = 1, gepackt_vorgemerkt = 0, gepackt_vorgemerkt_durch = NULL, updated_at = datetime(\'now\') WHERE id = ? AND gepackt_vorgemerkt = 1')
      .bind(packlistenEintragId)
      .run()
    return (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error confirming vorgemerkt pauschal:', error)
    return false
  }
}

export async function confirmVorgemerktForMitreisender(
  db: D1Database,
  packlistenEintragId: string,
  mitreisenderId: string
): Promise<boolean> {
  try {
    const temp = await isTemporaryPackingEintrag(db, packlistenEintragId)
    const mitTable = temp ? 'packlisten_eintrag_mitreisende_temporaer' : 'packlisten_eintrag_mitreisende'
    const r = await db
      .prepare(
        `UPDATE ${mitTable} SET gepackt = 1, gepackt_vorgemerkt = 0 WHERE packlisten_eintrag_id = ? AND mitreisender_id = ? AND gepackt_vorgemerkt = 1`
      )
      .bind(packlistenEintragId, mitreisenderId)
      .run()
    return (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error confirming vorgemerkt for mitreisender:', error)
    return false
  }
}

/**
 * Anzahl und optional Transport eines Mitreisenden für einen Packlisten-Eintrag setzen
 */
export async function setMitreisenderAnzahl(
  db: D1Database,
  packingItemId: string,
  mitreisenderId: string,
  anzahl: number,
  transportId?: string | null
): Promise<boolean> {
  try {
    const temp = await isTemporaryPackingEintrag(db, packingItemId)
    const mitTable = temp ? 'packlisten_eintrag_mitreisende_temporaer' : 'packlisten_eintrag_mitreisende'

    const existing = await db
      .prepare(`SELECT 1 FROM ${mitTable} WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`)
      .bind(packingItemId, mitreisenderId)
      .first()

    if (!existing) return false

    if (transportId !== undefined) {
      await db
        .prepare(`UPDATE ${mitTable} SET anzahl = ?, transport_id = ? WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`)
        .bind(anzahl, transportId || null, packingItemId, mitreisenderId)
        .run()
    } else {
      await db
        .prepare(`UPDATE ${mitTable} SET anzahl = ? WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?`)
        .bind(anzahl, packingItemId, mitreisenderId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error setting mitreisender anzahl:', error)
    return false
  }
}

/**
 * Mitreisenden von einem Packlisten-Eintrag entfernen.
 * Wenn es der letzte Mitreisende ist, wird der gesamte Eintrag gelöscht.
 */
export async function removeMitreisenderFromPackingItem(
  db: D1Database,
  packingItemId: string,
  mitreisenderId: string
): Promise<boolean> {
  try {
    // Normaler Eintrag: Zuordnung aus packlisten_eintrag_mitreisende entfernen
    await db
      .prepare('DELETE FROM packlisten_eintrag_mitreisende WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?')
      .bind(packingItemId, mitreisenderId)
      .run()

    // Temporärer Eintrag: Zuordnung aus packlisten_eintrag_mitreisende_temporaer entfernen
    await db
      .prepare(
        'DELETE FROM packlisten_eintrag_mitreisende_temporaer WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?'
      )
      .bind(packingItemId, mitreisenderId)
      .run()

    const remainingNormal = await db
      .prepare('SELECT 1 FROM packlisten_eintrag_mitreisende WHERE packlisten_eintrag_id = ? LIMIT 1')
      .bind(packingItemId)
      .first()

    const remainingTemp = await db
      .prepare('SELECT 1 FROM packlisten_eintrag_mitreisende_temporaer WHERE packlisten_eintrag_id = ? LIMIT 1')
      .bind(packingItemId)
      .first()

    // Wenn keine Mitreisenden mehr übrig sind (weder normal noch temporär),
    // den gesamten Packlisteneintrag entfernen (egal ob normal oder temporär).
    if (!remainingNormal && !remainingTemp) {
      await db.prepare('DELETE FROM packlisten_eintraege WHERE id = ?').bind(packingItemId).run()
      await db.prepare('DELETE FROM packlisten_eintraege_temporaer WHERE id = ?').bind(packingItemId).run()
    }
    return true
  } catch (error) {
    console.error('Error removing mitreisender from packing item:', error)
    return false
  }
}

/**
 * Erstellen einer neuen Hauptkategorie
 */
export async function createMainCategory(
  db: D1Database,
  titel: string,
  reihenfolge?: number,
  pauschalgewicht?: number | null,
  pauschal_pro_person?: boolean,
  pauschal_transport_id?: string | null
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    const order = reihenfolge ?? 999
    await db
      .prepare(
        'INSERT INTO hauptkategorien (id, titel, reihenfolge, pauschalgewicht, pauschal_pro_person, pauschal_transport_id) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, titel, order, pauschalgewicht ?? null, pauschal_pro_person ? 1 : 0, pauschal_transport_id ?? null)
      .run()
    return id
  } catch (error) {
    console.error('Error creating main category:', error)
    return null
  }
}

/**
 * Aktualisieren einer Hauptkategorie
 */
export async function updateMainCategory(
  db: D1Database,
  id: string,
  titel: string,
  reihenfolge?: number,
  pauschalgewicht?: number | null,
  pauschal_pro_person?: boolean,
  pauschal_transport_id?: string | null
): Promise<boolean> {
  try {
    const fields: string[] = ['titel = ?']
    const values: (string | number | null)[] = [titel]
    if (reihenfolge !== undefined) {
      fields.push('reihenfolge = ?')
      values.push(reihenfolge)
    }
    if (pauschalgewicht !== undefined) {
      fields.push('pauschalgewicht = ?')
      values.push(pauschalgewicht)
    }
    if (pauschal_pro_person !== undefined) {
      fields.push('pauschal_pro_person = ?')
      values.push(pauschal_pro_person ? 1 : 0)
    }
    if (pauschal_transport_id !== undefined) {
      fields.push('pauschal_transport_id = ?')
      values.push(pauschal_transport_id)
    }
    values.push(id)
    await db.prepare(`UPDATE hauptkategorien SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
    return true
  } catch (error) {
    console.error('Error updating main category:', error)
    return false
  }
}

/**
 * Löschen einer Hauptkategorie
 */
export async function deleteMainCategory(db: D1Database, id: string): Promise<boolean> {
  try {
    // Check if there are categories using this main category
    const categories = await db
      .prepare('SELECT COUNT(*) as count FROM kategorien WHERE hauptkategorie_id = ?')
      .bind(id)
      .first<{ count: number }>()
    
    if (categories && categories.count > 0) {
      throw new Error('Cannot delete main category with existing categories')
    }
    
    await db.prepare('DELETE FROM hauptkategorien WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting main category:', error)
    return false
  }
}

/**
 * Erstellen einer neuen Kategorie
 */
export async function createCategory(
  db: D1Database,
  titel: string,
  hauptkategorieId: string,
  reihenfolge?: number,
  pauschalgewicht?: number | null,
  pauschal_pro_person?: boolean,
  pauschal_transport_id?: string | null
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    const order = reihenfolge ?? 999
    await db
      .prepare(
        'INSERT INTO kategorien (id, titel, hauptkategorie_id, reihenfolge, pauschalgewicht, pauschal_pro_person, pauschal_transport_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        titel,
        hauptkategorieId,
        order,
        pauschalgewicht ?? null,
        pauschal_pro_person ? 1 : 0,
        pauschal_transport_id ?? null
      )
      .run()
    return id
  } catch (error) {
    console.error('Error creating category:', error)
    return null
  }
}

/**
 * Aktualisieren einer Kategorie
 */
export async function updateCategory(
  db: D1Database,
  id: string,
  titel: string,
  hauptkategorieId?: string,
  reihenfolge?: number,
  pauschalgewicht?: number | null,
  pauschal_pro_person?: boolean,
  pauschal_transport_id?: string | null
): Promise<boolean> {
  try {
    const fields: string[] = ['titel = ?']
    const values: (string | number | null)[] = [titel]

    if (hauptkategorieId !== undefined) {
      fields.push('hauptkategorie_id = ?')
      values.push(hauptkategorieId)
    }

    if (reihenfolge !== undefined) {
      fields.push('reihenfolge = ?')
      values.push(reihenfolge)
    }

    if (pauschalgewicht !== undefined) {
      fields.push('pauschalgewicht = ?')
      values.push(pauschalgewicht)
    }

    if (pauschal_pro_person !== undefined) {
      fields.push('pauschal_pro_person = ?')
      values.push(pauschal_pro_person ? 1 : 0)
    }

    if (pauschal_transport_id !== undefined) {
      fields.push('pauschal_transport_id = ?')
      values.push(pauschal_transport_id)
    }

    values.push(id)

    await db
      .prepare(`UPDATE kategorien SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run()
    return true
  } catch (error) {
    console.error('Error updating category:', error)
    return false
  }
}

/**
 * Löschen einer Kategorie
 */
export async function deleteCategory(db: D1Database, id: string): Promise<boolean> {
  try {
    // Check if there are equipment items using this category
    const equipment = await db
      .prepare('SELECT COUNT(*) as count FROM ausruestungsgegenstaende WHERE kategorie_id = ?')
      .bind(id)
      .first<{ count: number }>()
    
    if (equipment && equipment.count > 0) {
      throw new Error('Cannot delete category with existing equipment items')
    }
    
    await db.prepare('DELETE FROM kategorien WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting category:', error)
    return false
  }
}

/**
 * Abrufen aller Standard-Mitreisenden (is_default_member = true)
 */
export async function getDefaultMitreisende(db: D1Database): Promise<Mitreisender[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM mitreisende WHERE is_default_member = 1 ORDER BY name')
      .all<Mitreisender>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching default mitreisende:', error)
    return []
  }
}

/**
 * ==========================================
 * TAG-VERWALTUNG
 * ==========================================
 */

/**
 * Alle Tag-Kategorien (Sortierung wie in der Verwaltung)
 */
export async function getTagKategorien(db: D1Database): Promise<TagKategorie[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM tag_kategorien ORDER BY reihenfolge, titel')
      .all<TagKategorie>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching tag_kategorien:', error)
    return []
  }
}

/**
 * Tag-Kategorie aktualisieren (z. B. Reihenfolge nach Drag-and-Drop)
 */
export async function updateTagKategorie(
  db: D1Database,
  id: string,
  titel: string,
  reihenfolge: number
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE tag_kategorien SET titel = ?, reihenfolge = ? WHERE id = ?')
      .bind(titel, reihenfolge, id)
      .run()
    return true
  } catch (error) {
    console.error('Error updating tag_kategorie:', error)
    return false
  }
}

/**
 * Neue Tag-Kategorie anlegen
 */
export async function createTagKategorie(
  db: D1Database,
  titel: string,
  reihenfolge: number
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare('INSERT INTO tag_kategorien (id, titel, reihenfolge) VALUES (?, ?, ?)')
      .bind(id, titel, reihenfolge)
      .run()
    return id
  } catch (error) {
    console.error('Error creating tag_kategorie:', error)
    return null
  }
}

/**
 * Tag-Kategorie löschen inkl. aller zugehörigen Tags und Ausrüstungs-Zuordnungen
 */
export async function deleteTagKategorie(db: D1Database, id: string): Promise<boolean> {
  try {
    const tagsResult = await db
      .prepare('SELECT id FROM tags WHERE tag_kategorie_id = ?')
      .bind(id)
      .all<{ id: string }>()
    const tagIds = tagsResult.results?.map((r) => r.id) ?? []
    for (const tagId of tagIds) {
      await deleteTag(db, tagId)
    }
    await db.prepare('DELETE FROM tag_kategorien WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting tag_kategorie:', error)
    return false
  }
}

function rowToTag(row: Record<string, unknown>): Tag {
  return {
    id: String(row.id),
    titel: String(row.titel),
    farbe: row.farbe != null ? String(row.farbe) : null,
    icon: row.icon != null ? String(row.icon) : null,
    beschreibung: row.beschreibung != null ? String(row.beschreibung) : null,
    tag_kategorie_id: String(row.tag_kategorie_id ?? ''),
    reihenfolge: Number(row.reihenfolge ?? 0),
    created_at: String(row.created_at || ''),
  }
}

/**
 * Abrufen aller Tags (nach Tag-Kategorie und Reihenfolge)
 */
export async function getTags(db: D1Database): Promise<Tag[]> {
  try {
    const result = await db
      .prepare(`
        SELECT t.id, t.titel, t.farbe, t.icon, t.beschreibung, t.tag_kategorie_id, t.reihenfolge, t.created_at
        FROM tags t
        INNER JOIN tag_kategorien tk ON t.tag_kategorie_id = tk.id
        ORDER BY tk.reihenfolge, t.reihenfolge, t.titel
      `)
      .all<Record<string, unknown>>()
    const rows = result.results || []
    return rows.map((r) => rowToTag(r))
  } catch (error) {
    console.error('Error fetching tags:', error)
    return []
  }
}

/**
 * Erstellen eines neuen Tags
 */
export async function createTag(
  db: D1Database,
  titel: string,
  tagKategorieId: string,
  reihenfolge: number,
  farbe?: string | null,
  icon?: string | null,
  beschreibung?: string | null
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO tags (id, titel, farbe, icon, beschreibung, tag_kategorie_id, reihenfolge) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, titel, farbe || null, icon || null, beschreibung || null, tagKategorieId, reihenfolge)
      .run()
    return id
  } catch (error) {
    console.error('Error creating tag:', error)
    return null
  }
}

/**
 * Aktualisieren eines Tags
 */
export async function updateTag(
  db: D1Database,
  id: string,
  titel: string,
  tagKategorieId: string,
  reihenfolge: number,
  farbe?: string | null,
  icon?: string | null,
  beschreibung?: string | null
): Promise<boolean> {
  try {
    await db
      .prepare(
        'UPDATE tags SET titel = ?, farbe = ?, icon = ?, beschreibung = ?, tag_kategorie_id = ?, reihenfolge = ? WHERE id = ?'
      )
      .bind(titel, farbe || null, icon || null, beschreibung || null, tagKategorieId, reihenfolge, id)
      .run()
    return true
  } catch (error) {
    console.error('Error updating tag:', error)
    return false
  }
}

/**
 * Löschen eines Tags
 */
export async function deleteTag(db: D1Database, id: string): Promise<boolean> {
  try {
    // Erst alle Zuordnungen löschen
    await db
      .prepare('DELETE FROM ausruestungsgegenstaende_tags WHERE tag_id = ?')
      .bind(id)
      .run()
    
    // Dann den Tag selbst löschen
    await db.prepare('DELETE FROM tags WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting tag:', error)
    return false
  }
}

/**
 * Batch: Alle Tag-Equipment-Zuordnungen in einer Query laden
 * Rückgabe: Map<gegenstand_id, Tag[]>
 */
export async function getAllTagsForEquipment(db: D1Database): Promise<Map<string, Tag[]>> {
  try {
    const result = await db
      .prepare(`
        SELECT at.gegenstand_id,
               t.id, t.titel, t.farbe, t.icon, t.beschreibung, t.tag_kategorie_id, t.reihenfolge, t.created_at
        FROM ausruestungsgegenstaende_tags at
        JOIN tags t ON t.id = at.tag_id
        INNER JOIN tag_kategorien tk ON t.tag_kategorie_id = tk.id
        ORDER BY tk.reihenfolge, t.reihenfolge, t.titel
      `)
      .all<Record<string, unknown>>()
    const rows = result.results || []
    const map = new Map<string, Tag[]>()
    for (const row of rows) {
      const gegenstandId = String(row.gegenstand_id)
      const { gegenstand_id: _g, ...rest } = row
      const tag = rowToTag(rest)
      const existing = map.get(gegenstandId) || []
      existing.push(tag)
      map.set(gegenstandId, existing)
    }
    return map
  } catch (error) {
    console.error('Error fetching all tags for equipment:', error)
    return new Map()
  }
}

/**
 * Batch: Tags für mehrere Ausrüstungsgegenstände laden
 * Rückgabe: Map<gegenstand_id, Tag[]>
 */
export async function getTagsForEquipmentBatch(
  db: D1Database,
  gegenstandIds: string[]
): Promise<Map<string, Tag[]>> {
  if (gegenstandIds.length === 0) return new Map()
  try {
    const placeholders = gegenstandIds.map(() => '?').join(', ')
    const result = await db
      .prepare(`
        SELECT at.gegenstand_id,
               t.id, t.titel, t.farbe, t.icon, t.beschreibung, t.tag_kategorie_id, t.reihenfolge, t.created_at
        FROM ausruestungsgegenstaende_tags at
        JOIN tags t ON t.id = at.tag_id
        INNER JOIN tag_kategorien tk ON t.tag_kategorie_id = tk.id
        WHERE at.gegenstand_id IN (${placeholders})
        ORDER BY tk.reihenfolge, t.reihenfolge, t.titel
      `)
      .bind(...gegenstandIds)
      .all<Record<string, unknown>>()
    const rows = result.results || []
    const map = new Map<string, Tag[]>()
    for (const row of rows) {
      const gegenstandId = String(row.gegenstand_id)
      const { gegenstand_id: _g, ...rest } = row
      const tag = rowToTag(rest)
      const existing = map.get(gegenstandId) || []
      existing.push(tag)
      map.set(gegenstandId, existing)
    }
    return map
  } catch (error) {
    console.error('Error fetching tags for equipment batch:', error)
    return new Map()
  }
}

const D1_MAX_BIND_PARAMS = 99

/**
 * Batch: Standard-Mitreisende für mehrere Ausrüstungsgegenstände laden
 * Rückgabe: Map<gegenstand_id, string[]>
 * Batching bei >99 IDs wegen D1-Parameter-Limit
 */
export async function getStandardMitreisendeForEquipmentBatch(
  db: D1Database,
  gegenstandIds: string[]
): Promise<Map<string, string[]>> {
  if (gegenstandIds.length === 0) return new Map()
  const map = new Map<string, string[]>()
  try {
    for (let i = 0; i < gegenstandIds.length; i += D1_MAX_BIND_PARAMS) {
      const chunk = gegenstandIds.slice(i, i + D1_MAX_BIND_PARAMS)
      const placeholders = chunk.map(() => '?').join(', ')
      const result = await db
        .prepare(`
          SELECT gegenstand_id, mitreisender_id
          FROM ausruestungsgegenstaende_standard_mitreisende
          WHERE gegenstand_id IN (${placeholders})
        `)
        .bind(...chunk)
        .all<{ gegenstand_id: string; mitreisender_id: string }>()
      const rows = result.results || []
      for (const row of rows) {
        const gegenstandId = String(row.gegenstand_id)
        const existing = map.get(gegenstandId) || []
        existing.push(String(row.mitreisender_id))
        map.set(gegenstandId, existing)
      }
    }
    return map
  } catch (error) {
    console.error('Error fetching standard mitreisende for equipment batch:', error)
    return new Map()
  }
}

/**
 * Abrufen der Tags für einen Ausrüstungsgegenstand
 */
export async function getTagsForEquipment(db: D1Database, gegenstandId: string): Promise<Tag[]> {
  try {
    const result = await db
      .prepare(`
        SELECT t.id, t.titel, t.farbe, t.icon, t.beschreibung, t.tag_kategorie_id, t.reihenfolge, t.created_at
        FROM tags t
        INNER JOIN ausruestungsgegenstaende_tags at ON t.id = at.tag_id
        INNER JOIN tag_kategorien tk ON t.tag_kategorie_id = tk.id
        WHERE at.gegenstand_id = ?
        ORDER BY tk.reihenfolge, t.reihenfolge, t.titel
      `)
      .bind(gegenstandId)
      .all<Record<string, unknown>>()
    const rows = result.results || []
    return rows.map((r) => rowToTag(r))
  } catch (error) {
    console.error('Error fetching tags for equipment:', error)
    return []
  }
}

/**
 * Setzen der Tags für einen Ausrüstungsgegenstand (ersetzt alle bisherigen)
 */
export async function setTagsForEquipment(
  db: D1Database,
  gegenstandId: string,
  tagIds: string[]
): Promise<boolean> {
  try {
    // Erst alle bisherigen Zuordnungen löschen
    await db
      .prepare('DELETE FROM ausruestungsgegenstaende_tags WHERE gegenstand_id = ?')
      .bind(gegenstandId)
      .run()
    
    // Dann neue Zuordnungen hinzufügen
    for (const tagId of tagIds) {
      await db
        .prepare('INSERT INTO ausruestungsgegenstaende_tags (gegenstand_id, tag_id) VALUES (?, ?)')
        .bind(gegenstandId, tagId)
        .run()
    }
    
    return true
  } catch (error) {
    console.error('Error setting tags for equipment:', error)
    return false
  }
}

/**
 * Abrufen aller Ausrüstungsgegenstände mit bestimmten Tags
 */
export async function getEquipmentByTags(
  db: D1Database,
  tagIds: string[],
  includeStandard: boolean = true
): Promise<EquipmentItem[]> {
  try {
    let query = `
      SELECT DISTINCT
        a.*,
        k.titel as kategorie_titel,
        h.titel as hauptkategorie_titel,
        t.name as transport_name
      FROM ausruestungsgegenstaende a
      LEFT JOIN kategorien k ON a.kategorie_id = k.id
      LEFT JOIN hauptkategorien h ON k.hauptkategorie_id = h.id
      LEFT JOIN transportmittel t ON a.transport_id = t.id
      WHERE (
    `
    
    if (includeStandard) {
      query += 'a.is_standard = 1'
      if (tagIds.length > 0) {
        query += ' OR '
      }
    }
    
    if (tagIds.length > 0) {
      query += `
        a.id IN (
          SELECT gegenstand_id 
          FROM ausruestungsgegenstaende_tags 
          WHERE tag_id IN (${tagIds.map(() => '?').join(', ')})
        )
      `
    }
    
    query += `) AND a.status NOT IN ('Ausgemustert', 'Fest Installiert') ORDER BY h.reihenfolge, k.reihenfolge, a.was`
    
    const stmt = db.prepare(query)
    const result = await stmt.bind(...tagIds).all<Record<string, unknown>>()
    const rows = result.results || []

    const items: EquipmentItem[] = []
    for (const row of rows) {
      const id = String(row.id)
      const rawTyp = row.mitreisenden_typ
      const mitreisenden_typ = (rawTyp === 'alle' || rawTyp === 'ausgewaehlte' ? rawTyp : 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte'
      items.push({
        id,
        was: String(row.was),
        kategorie_id: String(row.kategorie_id),
        kategorie_titel: row.kategorie_titel ? String(row.kategorie_titel) : undefined,
        hauptkategorie_titel: row.hauptkategorie_titel ? String(row.hauptkategorie_titel) : undefined,
        transport_id: row.transport_id ? String(row.transport_id) : null,
        transport_name: row.transport_name ? String(row.transport_name) : undefined,
        einzelgewicht: row.einzelgewicht != null ? Number(row.einzelgewicht) : 0,
        standard_anzahl: row.standard_anzahl != null ? Number(row.standard_anzahl) : 1,
        status: String(row.status || 'Normal'),
        details: row.details ? String(row.details) : '',
        is_standard: !!row.is_standard,
        mitreisenden_typ,
        standard_mitreisende: [], // wird von equipment-by-tags Route per Batch ergänzt
        mengenregel: parseRegel(row.mengenregel as string | null | undefined),
        tags: [],
        links: [],
        created_at: String(row.created_at || ''),
      })
    }
    return items
  } catch (error) {
    console.error('Error fetching equipment by tags:', error)
    return []
  }
}

// --- Auth: Users ---

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first<User>()
  return row
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>()
  return row
}

/** Heimatadresse und Koordinaten für den eingeloggten User aktualisieren */
export async function updateUserHomeLocation(
  db: D1Database,
  userId: string,
  data: { heimat_adresse: string | null; heimat_lat: number | null; heimat_lng: number | null }
): Promise<boolean> {
  try {
    await db
      .prepare(
        'UPDATE users SET heimat_adresse = ?, heimat_lat = ?, heimat_lng = ?, updated_at = datetime(\'now\') WHERE id = ?'
      )
      .bind(data.heimat_adresse, data.heimat_lat, data.heimat_lng, userId)
      .run()
    return true
  } catch (error) {
    console.error('Error updating user home location:', error)
    return false
  }
}

export async function getUsersCount(db: D1Database): Promise<number> {
  const r = await db.prepare('SELECT COUNT(*) as c FROM users').first<{ c: number }>()
  return r?.c ?? 0
}

// --- Campingplätze & Routen-Cache ---

/** Alle (nicht archivierten) Campingplätze abrufen, optional inkl. Archiv */
export async function getCampingplaetze(
  db: D1Database,
  options?: { includeArchived?: boolean }
): Promise<Campingplatz[]> {
  try {
    const includeArchived = options?.includeArchived ?? false
    const baseFrom = `FROM campingplaetze c
      LEFT JOIN campingplatz_fotos cf ON cf.campingplatz_id = c.id AND cf.is_cover = 1`
    const query = includeArchived
      ? `SELECT c.*, cf.id AS cover_foto_id, cf.r2_object_key AS cover_r2_object_key,
         cf.google_photo_name AS cover_google_photo_name ${baseFrom}
         ORDER BY c.land, c.bundesland, c.ort, c.name`
      : `SELECT c.*, cf.id AS cover_foto_id, cf.r2_object_key AS cover_r2_object_key,
         cf.google_photo_name AS cover_google_photo_name ${baseFrom}
         WHERE c.is_archived = 0
         ORDER BY c.land, c.bundesland, c.ort, c.name`
    const result = await db.prepare(query).all<Record<string, unknown>>()
    const rows = result.results || []
    return rows.map((row) => mapCampingplatzRow(row))
  } catch (error) {
    console.error('Error fetching campingplaetze:', error)
    return []
  }
}

/** Anzahl Urlaube je Campingplatz (DISTINCT urlaub_id), inkl. beliebiger Zuordnungen */
export async function getUrlaubCountByCampingplatzIds(
  db: D1Database,
  ids: string[]
): Promise<Record<string, number>> {
  if (ids.length === 0) return {}
  try {
    const placeholders = ids.map(() => '?').join(',')
    const result = await db
      .prepare(
        `SELECT uc.campingplatz_id AS id, COUNT(DISTINCT uc.urlaub_id) AS c
         FROM urlaub_campingplaetze uc
         INNER JOIN urlaube u ON u.id = uc.urlaub_id
         WHERE uc.campingplatz_id IN (${placeholders})
         GROUP BY uc.campingplatz_id`
      )
      .bind(...ids)
      .all<{ id: string; c: number }>()
    const map: Record<string, number> = {}
    for (const row of result.results || []) {
      map[row.id] = row.c
    }
    return map
  } catch (error) {
    console.error('Error counting urlaube per campingplatz:', error)
    return {}
  }
}

export async function getUrlaubCountForCampingplatz(
  db: D1Database,
  campingplatzId: string
): Promise<number> {
  try {
    const row = await db
      .prepare(
        `SELECT COUNT(DISTINCT uc.urlaub_id) AS c
         FROM urlaub_campingplaetze uc
         INNER JOIN urlaube u ON u.id = uc.urlaub_id
         WHERE uc.campingplatz_id = ?`
      )
      .bind(campingplatzId)
      .first<{ c: number }>()
    return row?.c ?? 0
  } catch (error) {
    console.error('Error counting urlaube for campingplatz:', error)
    return 0
  }
}

export async function getCampingplatzById(
  db: D1Database,
  id: string
): Promise<Campingplatz | null> {
  try {
    const row = await db
      .prepare(
        `SELECT c.*, cf.id AS cover_foto_id, cf.r2_object_key AS cover_r2_object_key,
         cf.google_photo_name AS cover_google_photo_name
         FROM campingplaetze c
         LEFT JOIN campingplatz_fotos cf ON cf.campingplatz_id = c.id AND cf.is_cover = 1
         WHERE c.id = ?`
      )
      .bind(id)
      .first<Record<string, unknown>>()
    if (!row) return null
    return mapCampingplatzRow(row)
  } catch (error) {
    console.error('Error fetching campingplatz by id:', error)
    return null
  }
}

export async function getCampingplatzFotos(
  db: D1Database,
  campingplatzId: string
): Promise<CampingplatzFoto[]> {
  try {
    const result = await db
      .prepare(
        `SELECT * FROM campingplatz_fotos WHERE campingplatz_id = ?
         ORDER BY sort_index ASC, created_at ASC`
      )
      .bind(campingplatzId)
      .all<Record<string, unknown>>()
    const rows = result.results || []
    return rows.map((row) => mapCampingplatzFotoRow(row))
  } catch (error) {
    console.error('Error fetching campingplatz fotos:', error)
    return []
  }
}

export async function getCampingplatzFotoById(
  db: D1Database,
  fotoId: string
): Promise<CampingplatzFoto | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM campingplatz_fotos WHERE id = ?')
      .bind(fotoId)
      .first<Record<string, unknown>>()
    if (!row) return null
    return mapCampingplatzFotoRow(row)
  } catch (error) {
    console.error('Error fetching campingplatz foto:', error)
    return null
  }
}

export async function syncCampingplatzPhotoNameFromCover(
  db: D1Database,
  campingplatzId: string
): Promise<void> {
  try {
    const cover = await db
      .prepare(
        `SELECT google_photo_name FROM campingplatz_fotos
         WHERE campingplatz_id = ? AND is_cover = 1 LIMIT 1`
      )
      .bind(campingplatzId)
      .first<{ google_photo_name: string | null }>()
    const name = cover?.google_photo_name != null ? String(cover.google_photo_name) : null
    await db
      .prepare(
        `UPDATE campingplaetze SET photo_name = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .bind(name, campingplatzId)
      .run()
  } catch (error) {
    console.error('Error syncing photo_name from cover:', error)
  }
}

export async function createCampingplatzFoto(
  db: D1Database,
  opts: {
    campingplatz_id: string
    source: 'google' | 'upload'
    google_photo_name?: string | null
    google_attributions?: string[] | null
    r2_object_key?: string | null
    content_type?: string
    /** Wenn true, wird dieses Foto zum Cover (andere Cover werden zurückgesetzt). */
    setAsCover?: boolean
  }
): Promise<CampingplatzFoto | null> {
  try {
    const countRow = await db
      .prepare(
        `SELECT COUNT(*) as n FROM campingplatz_fotos WHERE campingplatz_id = ?`
      )
      .bind(opts.campingplatz_id)
      .first<{ n: number }>()
    const n = Number(countRow?.n ?? 0)
    const makeCover = opts.setAsCover === true || n === 0

    if (makeCover) {
      await db
        .prepare(
          `UPDATE campingplatz_fotos SET is_cover = 0 WHERE campingplatz_id = ?`
        )
        .bind(opts.campingplatz_id)
        .run()
    }

    const id = crypto.randomUUID()
    const sortIndex = n
    const attrsJson =
      opts.google_attributions && opts.google_attributions.length
        ? JSON.stringify(opts.google_attributions)
        : null

    await db
      .prepare(
        `INSERT INTO campingplatz_fotos (
          id, campingplatz_id, sort_index, is_cover, source,
          google_photo_name, r2_object_key, content_type, google_attributions_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        opts.campingplatz_id,
        sortIndex,
        makeCover ? 1 : 0,
        opts.source,
        opts.google_photo_name ?? null,
        opts.r2_object_key ?? null,
        opts.content_type ?? 'image/jpeg',
        attrsJson
      )
      .run()

    await syncCampingplatzPhotoNameFromCover(db, opts.campingplatz_id)
    return getCampingplatzFotoById(db, id)
  } catch (error) {
    console.error('Error creating campingplatz foto:', error)
    return null
  }
}

export async function updateCampingplatzFotoR2(
  db: D1Database,
  fotoId: string,
  r2_object_key: string,
  content_type?: string
): Promise<CampingplatzFoto | null> {
  try {
    await db
      .prepare(
        `UPDATE campingplatz_fotos SET r2_object_key = ?,
         content_type = COALESCE(?, content_type)
         WHERE id = ?`
      )
      .bind(r2_object_key, content_type ?? null, fotoId)
      .run()
    return getCampingplatzFotoById(db, fotoId)
  } catch (error) {
    console.error('Error updating campingplatz foto r2:', error)
    return null
  }
}

export async function setCampingplatzCoverFoto(
  db: D1Database,
  campingplatzId: string,
  fotoId: string
): Promise<boolean> {
  try {
    const exists = await db
      .prepare(
        `SELECT 1 FROM campingplatz_fotos WHERE id = ? AND campingplatz_id = ? LIMIT 1`
      )
      .bind(fotoId, campingplatzId)
      .first()
    if (!exists) return false

    await db
      .prepare(`UPDATE campingplatz_fotos SET is_cover = 0 WHERE campingplatz_id = ?`)
      .bind(campingplatzId)
      .run()
    await db
      .prepare(`UPDATE campingplatz_fotos SET is_cover = 1 WHERE id = ?`)
      .bind(fotoId)
      .run()
    await syncCampingplatzPhotoNameFromCover(db, campingplatzId)
    return true
  } catch (error) {
    console.error('Error setting cover foto:', error)
    return false
  }
}

export async function reorderCampingplatzFotos(
  db: D1Database,
  campingplatzId: string,
  orderedIds: string[]
): Promise<boolean> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      const fid = orderedIds[i]
      await db
        .prepare(
          `UPDATE campingplatz_fotos SET sort_index = ?
           WHERE id = ? AND campingplatz_id = ?`
        )
        .bind(i, fid, campingplatzId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error reordering campingplatz fotos:', error)
    return false
  }
}

export async function deleteCampingplatzFoto(
  db: D1Database,
  campingplatzId: string,
  fotoId: string
): Promise<{ deleted: boolean; wasCover: boolean; r2_object_key: string | null }> {
  try {
    const row = await db
      .prepare(
        `SELECT is_cover, r2_object_key FROM campingplatz_fotos
         WHERE id = ? AND campingplatz_id = ?`
      )
      .bind(fotoId, campingplatzId)
      .first<{ is_cover: number; r2_object_key: string | null }>()
    if (!row) return { deleted: false, wasCover: false, r2_object_key: null }

    const wasCover = !!(row.is_cover ?? 0)
    const r2Key = row.r2_object_key != null ? String(row.r2_object_key) : null

    await db.prepare('DELETE FROM campingplatz_fotos WHERE id = ?').bind(fotoId).run()

    if (wasCover) {
      const next = await db
        .prepare(
          `SELECT id FROM campingplatz_fotos WHERE campingplatz_id = ?
           ORDER BY sort_index ASC, created_at ASC LIMIT 1`
        )
        .bind(campingplatzId)
        .first<{ id: string }>()
      if (next?.id) {
        await db
          .prepare(`UPDATE campingplatz_fotos SET is_cover = 1 WHERE id = ?`)
          .bind(next.id)
          .run()
      }
    }

    await syncCampingplatzPhotoNameFromCover(db, campingplatzId)
    return { deleted: true, wasCover, r2_object_key: r2Key }
  } catch (error) {
    console.error('Error deleting campingplatz foto:', error)
    return { deleted: false, wasCover: false, r2_object_key: null }
  }
}

export async function createCampingplatz(
  db: D1Database,
  data: {
    name: string
    land: string
    bundesland?: string | null
    ort: string
    webseite?: string | null
    video_link?: string | null
    platz_typ: CampingplatzTyp
    pros?: string[]
    cons?: string[]
    adresse?: string | null
    lat?: number | null
    lng?: number | null
    photo_name?: string | null
    aufwunschliste?: boolean
    top_favorit?: boolean
  }
): Promise<Campingplatz | null> {
  try {
    const id = crypto.randomUUID()
    const auf = data.aufwunschliste !== false ? 1 : 0
    const top = data.top_favorit ? 1 : 0
    await db
      .prepare(
        `INSERT INTO campingplaetze 
         (id, name, land, bundesland, ort, webseite, video_link, platz_typ, pros, cons, adresse, lat, lng, photo_name, aufwunschliste, top_favorit) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        data.name,
        data.land,
        data.bundesland ?? null,
        data.ort,
        data.webseite ?? null,
        data.video_link ?? null,
        data.platz_typ,
        JSON.stringify(data.pros ?? []),
        JSON.stringify(data.cons ?? []),
        data.adresse ?? null,
        data.lat ?? null,
        data.lng ?? null,
        data.photo_name ?? null,
        auf,
        top
      )
      .run()
    return getCampingplatzById(db, id)
  } catch (error) {
    console.error('Error creating campingplatz:', error)
    return null
  }
}

export async function updateCampingplatz(
  db: D1Database,
  id: string,
  updates: Partial<{
    name: string
    land: string
    bundesland: string | null
    ort: string
    webseite: string | null
    video_link: string | null
    platz_typ: CampingplatzTyp
    pros: string[]
    cons: string[]
    adresse: string | null
    lat: number | null
    lng: number | null
    photo_name: string | null
    is_archived: boolean
    aufwunschliste: boolean
    top_favorit: boolean
  }>
): Promise<Campingplatz | null> {
  try {
    const fields: string[] = []
    const values: (string | number | null)[] = []

    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.land !== undefined) {
      fields.push('land = ?')
      values.push(updates.land)
    }
    if (updates.bundesland !== undefined) {
      fields.push('bundesland = ?')
      values.push(updates.bundesland)
    }
    if (updates.ort !== undefined) {
      fields.push('ort = ?')
      values.push(updates.ort)
    }
    if (updates.webseite !== undefined) {
      fields.push('webseite = ?')
      values.push(updates.webseite)
    }
    if (updates.video_link !== undefined) {
      fields.push('video_link = ?')
      values.push(updates.video_link)
    }
    if (updates.platz_typ !== undefined) {
      fields.push('platz_typ = ?')
      values.push(updates.platz_typ)
    }
    if (updates.pros !== undefined) {
      fields.push('pros = ?')
      values.push(JSON.stringify(updates.pros ?? []))
    }
    if (updates.cons !== undefined) {
      fields.push('cons = ?')
      values.push(JSON.stringify(updates.cons ?? []))
    }
    if (updates.adresse !== undefined) {
      fields.push('adresse = ?')
      values.push(updates.adresse)
    }
    if (updates.lat !== undefined) {
      fields.push('lat = ?')
      values.push(updates.lat)
    }
    if (updates.lng !== undefined) {
      fields.push('lng = ?')
      values.push(updates.lng)
    }
    if (updates.photo_name !== undefined) {
      fields.push('photo_name = ?')
      values.push(updates.photo_name)
    }
    if (updates.is_archived !== undefined) {
      fields.push('is_archived = ?')
      values.push(updates.is_archived ? 1 : 0)
    }
    if (updates.aufwunschliste !== undefined) {
      fields.push('aufwunschliste = ?')
      values.push(updates.aufwunschliste ? 1 : 0)
    }
    if (updates.top_favorit !== undefined) {
      fields.push('top_favorit = ?')
      values.push(updates.top_favorit ? 1 : 0)
    }

    if (fields.length === 0) {
      return getCampingplatzById(db, id)
    }

    fields.push('updated_at = datetime(\'now\')')
    values.push(id)

    const query = `UPDATE campingplaetze SET ${fields.join(', ')} WHERE id = ?`
    await db.prepare(query).bind(...values).run()
    return getCampingplatzById(db, id)
  } catch (error) {
    console.error('Error updating campingplatz:', error)
    return null
  }
}

export async function deleteCampingplatz(db: D1Database, id: string): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM campingplaetze WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting campingplatz:', error)
    return false
  }
}

export async function archiveCampingplatz(
  db: D1Database,
  id: string
): Promise<boolean> {
  try {
    await db
      .prepare(
        'UPDATE campingplaetze SET is_archived = 1, updated_at = datetime(\'now\') WHERE id = ?'
      )
      .bind(id)
      .run()
    return true
  } catch (error) {
    console.error('Error archiving campingplatz:', error)
    return false
  }
}

// Verknüpfung Urlaube <-> Campingplätze
export async function getCampingplaetzeForVacation(
  db: D1Database,
  vacationId: string
): Promise<Campingplatz[]> {
  try {
    const result = await db
      .prepare(
        `SELECT c.*, cf.id AS cover_foto_id, cf.r2_object_key AS cover_r2_object_key,
         cf.google_photo_name AS cover_google_photo_name
         FROM urlaub_campingplaetze uc
         JOIN campingplaetze c ON uc.campingplatz_id = c.id
         LEFT JOIN campingplatz_fotos cf ON cf.campingplatz_id = c.id AND cf.is_cover = 1
         WHERE uc.urlaub_id = ?
         ORDER BY COALESCE(uc.sort_index, 999999), c.land, c.bundesland, c.ort, c.name`
      )
      .bind(vacationId)
      .all<Record<string, unknown>>()
    const rows = result.results || []
    return rows.map((row) => mapCampingplatzRow(row))
  } catch (error) {
    console.error('Error fetching campingplaetze for vacation:', error)
    return []
  }
}

/** Alle Campingplätze für mehrere Urlaube in wenigen Datenbank-Runden (eine Query pro Chunk). */
export async function getCampingplaetzeForVacationsBatch(
  db: D1Database,
  vacationIds: string[]
): Promise<Record<string, Campingplatz[]>> {
  const out: Record<string, Campingplatz[]> = {}
  for (const id of vacationIds) {
    out[id] = []
  }
  if (vacationIds.length === 0) return out

  const CHUNK = 400

  try {
    for (let i = 0; i < vacationIds.length; i += CHUNK) {
      const chunk = vacationIds.slice(i, i + CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      const sql = `SELECT uc.urlaub_id AS urlaub_id, c.*, cf.id AS cover_foto_id, cf.r2_object_key AS cover_r2_object_key,
         cf.google_photo_name AS cover_google_photo_name
         FROM urlaub_campingplaetze uc
         JOIN campingplaetze c ON uc.campingplatz_id = c.id
         LEFT JOIN campingplatz_fotos cf ON cf.campingplatz_id = c.id AND cf.is_cover = 1
         WHERE uc.urlaub_id IN (${placeholders})
         ORDER BY uc.urlaub_id, COALESCE(uc.sort_index, 999999), c.land, c.bundesland, c.ort, c.name`
      const result = await db
        .prepare(sql)
        .bind(...chunk)
        .all<Record<string, unknown>>()
      const rows = result.results || []
      for (const row of rows) {
        const uid = String(row.urlaub_id ?? '')
        if (!uid || out[uid] === undefined) continue
        const cpRow = { ...row }
        delete cpRow.urlaub_id
        out[uid].push(mapCampingplatzRow(cpRow))
      }
    }
    return out
  } catch (error) {
    console.error('Error batch-fetching campingplaetze for vacations:', error)
    return out
  }
}

export async function setCampingplaetzeForVacation(
  db: D1Database,
  vacationId: string,
  campingplatzIds: string[]
): Promise<boolean> {
  try {
    await db
      .prepare('DELETE FROM urlaub_campingplaetze WHERE urlaub_id = ?')
      .bind(vacationId)
      .run()
    for (let index = 0; index < campingplatzIds.length; index++) {
      const cid = campingplatzIds[index]
      await db
        .prepare(
          'INSERT INTO urlaub_campingplaetze (urlaub_id, campingplatz_id, sort_index) VALUES (?, ?, ?)'
        )
        .bind(vacationId, cid, index)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error setting campingplaetze for vacation:', error)
    return false
  }
}

// Routen-Cache
export async function getRouteForUserAndCampingplatz(
  db: D1Database,
  userId: string,
  campingplatzId: string
): Promise<CampingplatzRouteCacheEntry | null> {
  try {
    const row = await db
      .prepare(
        'SELECT * FROM campingplatz_routen_cache WHERE user_id = ? AND campingplatz_id = ?'
      )
      .bind(userId, campingplatzId)
      .first<CampingplatzRouteCacheEntry>()
    return row || null
  } catch (error) {
    console.error('Error fetching route cache entry:', error)
    return null
  }
}

const ROUTE_CACHE_IN_CHUNK = 80

/** Alle Routen-Einträge für einen User und die gegebenen Campingplatz-IDs (D1 IN-Limit beachten). */
export async function getRoutesForUserAndCampingplatzIds(
  db: D1Database,
  userId: string,
  campingplatzIds: string[]
): Promise<Map<string, CampingplatzRouteCacheEntry>> {
  const out = new Map<string, CampingplatzRouteCacheEntry>()
  if (campingplatzIds.length === 0) return out
  try {
    for (let i = 0; i < campingplatzIds.length; i += ROUTE_CACHE_IN_CHUNK) {
      const chunk = campingplatzIds.slice(i, i + ROUTE_CACHE_IN_CHUNK)
      const placeholders = chunk.map(() => '?').join(',')
      const result = await db
        .prepare(
          `SELECT * FROM campingplatz_routen_cache WHERE user_id = ? AND campingplatz_id IN (${placeholders})`
        )
        .bind(userId, ...chunk)
        .all<CampingplatzRouteCacheEntry>()
      for (const row of result.results || []) {
        out.set(row.campingplatz_id, row)
      }
    }
    return out
  } catch (error) {
    console.error('Error bulk-fetching route cache:', error)
    return out
  }
}

export async function setRouteForUserAndCampingplatz(
  db: D1Database,
  entry: CampingplatzRouteCacheEntry
): Promise<boolean> {
  try {
    await db
      .prepare(
        `INSERT INTO campingplatz_routen_cache 
           (user_id, campingplatz_id, distance_km, duration_min, provider, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(user_id, campingplatz_id) DO UPDATE SET
           distance_km = excluded.distance_km,
           duration_min = excluded.duration_min,
           provider = excluded.provider,
           updated_at = datetime('now')`
      )
      .bind(
        entry.user_id,
        entry.campingplatz_id,
        entry.distance_km,
        entry.duration_min,
        entry.provider
      )
      .run()
    return true
  } catch (error) {
    console.error('Error setting route cache entry:', error)
    return false
  }
}

export async function deleteRoutesForUser(
  db: D1Database,
  userId: string
): Promise<boolean> {
  try {
    await db
      .prepare('DELETE FROM campingplatz_routen_cache WHERE user_id = ?')
      .bind(userId)
      .run()
    return true
  } catch (error) {
    console.error('Error deleting route cache entries for user:', error)
    return false
  }
}

export async function deleteRoutesForCampingplatz(
  db: D1Database,
  campingplatzId: string
): Promise<boolean> {
  try {
    await db
      .prepare('DELETE FROM campingplatz_routen_cache WHERE campingplatz_id = ?')
      .bind(campingplatzId)
      .run()
    return true
  } catch (error) {
    console.error('Error deleting route cache entries for campingplatz:', error)
    return false
  }
}

/** Alle User (für Admin: Passwort zurücksetzen, etc.) */
export async function getUsers(
  db: D1Database
): Promise<Array<{ id: string; email: string; role: UserRole; mitreisender_id: string | null; mitreisender_name?: string | null }>> {
  try {
    const result = await db
      .prepare(
        'SELECT u.id, u.email, u.role, u.mitreisender_id, m.name as mitreisender_name FROM users u LEFT JOIN mitreisende m ON u.mitreisender_id = m.id ORDER BY u.email'
      )
      .all<{ id: string; email: string; role: string; mitreisender_id: string | null; mitreisender_name: string | null }>()
    return (result.results || []).map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role as UserRole,
      mitreisender_id: r.mitreisender_id,
      mitreisender_name: r.mitreisender_name ?? null
    }))
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

export async function createUser(
  db: D1Database,
  email: string,
  passwordHash: string,
  role: UserRole,
  mitreisenderId: string | null
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO users (id, email, password_hash, role, mitreisender_id) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, email.toLowerCase().trim(), passwordHash, role, mitreisenderId)
      .run()
    return id
  } catch (error) {
    console.error('Error creating user:', error)
    return null
  }
}

export async function updateUserRole(
  db: D1Database,
  userId: string,
  role: UserRole
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(role, userId)
      .run()
    return true
  } catch (error) {
    console.error('Error updating user role:', error)
    return false
  }
}

export async function updateUserMitreisender(
  db: D1Database,
  userId: string,
  mitreisenderId: string | null
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE users SET mitreisender_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(mitreisenderId, userId)
      .run()
    return true
  } catch (error) {
    console.error('Error updating user mitreisender:', error)
    return false
  }
}

export async function updateUserPassword(
  db: D1Database,
  userId: string,
  passwordHash: string,
  setMustChangePassword?: boolean
): Promise<boolean> {
  try {
    if (setMustChangePassword === true) {
      await db
        .prepare(
          'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, must_change_password = 1, updated_at = datetime(\'now\') WHERE id = ?'
        )
        .bind(passwordHash, userId)
        .run()
    } else {
      await db
        .prepare(
          'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, updated_at = datetime(\'now\') WHERE id = ?'
        )
        .bind(passwordHash, userId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error updating user password:', error)
    return false
  }
}

/** must_change_password zurücksetzen (nach eigener Passwortänderung) */
export async function clearUserMustChangePassword(
  db: D1Database,
  userId: string
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE users SET must_change_password = 0, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(userId)
      .run()
    return true
  } catch (error) {
    console.error('Error clearing must_change_password:', error)
    return false
  }
}

export async function updateMitreisenderUserId(
  db: D1Database,
  mitreisenderId: string,
  userId: string | null
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE mitreisende SET user_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .bind(userId, mitreisenderId)
      .run()
    return true
  } catch (error) {
    console.error('Error updating mitreisender user_id:', error)
    return false
  }
}

// --- Auth: Einladungen ---

export async function getInvitationByToken(
  db: D1Database,
  token: string
): Promise<(Einladung & { mitreisender_name: string }) | null> {
  const row = await db
    .prepare(
      `SELECT e.*, m.name as mitreisender_name 
       FROM einladungen e 
       JOIN mitreisende m ON e.mitreisender_id = m.id 
       WHERE e.token = ? AND e.angenommen_am IS NULL`
    )
    .bind(token)
    .first<Einladung & { mitreisender_name: string }>()
  return row
}

export async function createInvitation(
  db: D1Database,
  mitreisenderId: string,
  role: 'admin' | 'kind' | 'gast',
  createdByUserId: string
): Promise<{ id: string; token: string } | null> {
  try {
    const id = crypto.randomUUID()
    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
    await db
      .prepare(
        'INSERT INTO einladungen (id, token, mitreisender_id, role, erstellt_von) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, token, mitreisenderId, role, createdByUserId)
      .run()
    return { id, token }
  } catch (error) {
    console.error('Error creating invitation:', error)
    return null
  }
}

export async function acceptInvitation(
  db: D1Database,
  invitationId: string
): Promise<boolean> {
  try {
    await db
      .prepare(
        'UPDATE einladungen SET angenommen_am = datetime(\'now\') WHERE id = ?'
      )
      .bind(invitationId)
      .run()
    return true
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return false
  }
}

// --- Auth: Mitreisende Berechtigungen ---

export async function getMitreisendeBerechtigungen(
  db: D1Database,
  mitreisenderId: string
): Promise<string[]> {
  const rows = await db
    .prepare('SELECT berechtigung FROM mitreisende_berechtigungen WHERE mitreisender_id = ?')
    .bind(mitreisenderId)
    .all<{ berechtigung: string }>()
  return (rows.results || []).map(r => r.berechtigung)
}

export async function setMitreisendeBerechtigungen(
  db: D1Database,
  mitreisenderId: string,
  berechtigungen: string[]
): Promise<boolean> {
  try {
    await db
      .prepare('DELETE FROM mitreisende_berechtigungen WHERE mitreisender_id = ?')
      .bind(mitreisenderId)
      .run()
    for (const b of berechtigungen) {
      await db
        .prepare(
          'INSERT INTO mitreisende_berechtigungen (mitreisender_id, berechtigung) VALUES (?, ?)'
        )
        .bind(mitreisenderId, b)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error setting mitreisende berechtigungen:', error)
    return false
  }
}

// --- Checklisten (Tools) ---

function rowErledigtToBool(v: number | boolean | undefined): boolean {
  return v === true || v === 1
}

/** D1-Zeile: SQLite liefert erledigt als 0/1 */
type ChecklisteEintragRow = Omit<ChecklisteEintrag, 'erledigt'> & { erledigt: number }

function mapEintragRow(e: ChecklisteEintragRow): ChecklisteEintrag {
  return {
    ...e,
    erledigt: rowErledigtToBool(e.erledigt),
  }
}

export async function getChecklistenFullTree(db: D1Database): Promise<ChecklisteMitStruktur[]> {
  try {
    const lists = await db
      .prepare('SELECT * FROM checklisten ORDER BY reihenfolge ASC, titel ASC')
      .all<Checkliste>()
    const rows = lists.results || []
    if (rows.length === 0) return []

    const ids = rows.map(r => r.id)
    const ph = ids.map(() => '?').join(',')

    const catsRes = await db
      .prepare(
        `SELECT * FROM checklisten_kategorien WHERE checklist_id IN (${ph}) ORDER BY checklist_id, reihenfolge ASC, titel ASC`
      )
      .bind(...ids)
      .all<ChecklisteKategorie>()
    const allCats = catsRes.results || []

    const entsRes = await db
      .prepare(
        `SELECT * FROM checklisten_eintraege WHERE checklist_id IN (${ph}) ORDER BY checklist_id, kategorie_id, reihenfolge ASC`
      )
      .bind(...ids)
      .all<ChecklisteEintragRow>()
    const allEnts = (entsRes.results || []).map(e => mapEintragRow(e as ChecklisteEintragRow))

    const entsByKat = new Map<string, ChecklisteEintrag[]>()
    for (const e of allEnts) {
      const list = entsByKat.get(e.kategorie_id) ?? []
      list.push(e)
      entsByKat.set(e.kategorie_id, list)
    }

    const catsByList = new Map<string, ChecklisteKategorie[]>()
    for (const k of allCats) {
      const list = catsByList.get(k.checklist_id) ?? []
      list.push(k)
      catsByList.set(k.checklist_id, list)
    }

    return rows.map(c => ({
      ...c,
      kategorien: (catsByList.get(c.id) ?? []).map(kat => ({
        ...kat,
        eintraege: entsByKat.get(kat.id) ?? [],
      })),
    }))
  } catch (error) {
    console.error('Error getChecklistenFullTree:', error)
    return []
  }
}

export async function getChecklisteById(
  db: D1Database,
  checklistId: string
): Promise<ChecklisteMitStruktur | null> {
  try {
    const c = await db
      .prepare('SELECT * FROM checklisten WHERE id = ?')
      .bind(checklistId)
      .first<Checkliste>()
    if (!c) return null

    const catsRes = await db
      .prepare(
        'SELECT * FROM checklisten_kategorien WHERE checklist_id = ? ORDER BY reihenfolge ASC, titel ASC'
      )
      .bind(checklistId)
      .all<ChecklisteKategorie>()
    const cats = catsRes.results || []

    const entsRes = await db
      .prepare(
        'SELECT * FROM checklisten_eintraege WHERE checklist_id = ? ORDER BY kategorie_id, reihenfolge ASC'
      )
      .bind(checklistId)
      .all<ChecklisteEintragRow>()
    const allEnts = (entsRes.results || []).map(e => mapEintragRow(e as ChecklisteEintragRow))

    const entsByKat = new Map<string, ChecklisteEintrag[]>()
    for (const e of allEnts) {
      const list = entsByKat.get(e.kategorie_id) ?? []
      list.push(e)
      entsByKat.set(e.kategorie_id, list)
    }

    return {
      ...c,
      kategorien: cats.map(kat => ({
        ...kat,
        eintraege: entsByKat.get(kat.id) ?? [],
      })),
    }
  } catch (error) {
    console.error('Error getChecklisteById:', error)
    return null
  }
}

export async function createCheckliste(db: D1Database, titel: string): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    const maxRow = await db
      .prepare('SELECT MAX(reihenfolge) as m FROM checklisten')
      .first<{ m: number | null }>()
    const reihenfolge = (maxRow?.m ?? -1) + 1
    await db
      .prepare(
        'INSERT INTO checklisten (id, titel, reihenfolge) VALUES (?, ?, ?)'
      )
      .bind(id, titel.trim(), reihenfolge)
      .run()
    return id
  } catch (error) {
    console.error('Error createCheckliste:', error)
    return null
  }
}

export async function updateCheckliste(
  db: D1Database,
  id: string,
  fields: { titel?: string; reihenfolge?: number }
): Promise<boolean> {
  try {
    if (fields.titel !== undefined) {
      await db
        .prepare('UPDATE checklisten SET titel = ? WHERE id = ?')
        .bind(fields.titel.trim(), id)
        .run()
    }
    if (fields.reihenfolge !== undefined) {
      await db
        .prepare('UPDATE checklisten SET reihenfolge = ? WHERE id = ?')
        .bind(fields.reihenfolge, id)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error updateCheckliste:', error)
    return false
  }
}

export async function deleteCheckliste(db: D1Database, id: string): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM checklisten WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleteCheckliste:', error)
    return false
  }
}

export async function reorderChecklisten(db: D1Database, orderedIds: string[]): Promise<boolean> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .prepare('UPDATE checklisten SET reihenfolge = ? WHERE id = ?')
        .bind(i, orderedIds[i])
        .run()
    }
    return true
  } catch (error) {
    console.error('Error reorderChecklisten:', error)
    return false
  }
}

export async function createChecklisteKategorie(
  db: D1Database,
  checklistId: string,
  titel: string
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    const maxRow = await db
      .prepare(
        'SELECT MAX(reihenfolge) as m FROM checklisten_kategorien WHERE checklist_id = ?'
      )
      .bind(checklistId)
      .first<{ m: number | null }>()
    const reihenfolge = (maxRow?.m ?? -1) + 1
    await db
      .prepare(
        'INSERT INTO checklisten_kategorien (id, checklist_id, titel, reihenfolge) VALUES (?, ?, ?, ?)'
      )
      .bind(id, checklistId, titel.trim(), reihenfolge)
      .run()
    return id
  } catch (error) {
    console.error('Error createChecklisteKategorie:', error)
    return null
  }
}

export async function updateChecklisteKategorie(
  db: D1Database,
  checklistId: string,
  id: string,
  fields: { titel?: string; reihenfolge?: number }
): Promise<boolean> {
  try {
    const exists = await db
      .prepare(
        'SELECT 1 as x FROM checklisten_kategorien WHERE id = ? AND checklist_id = ? LIMIT 1'
      )
      .bind(id, checklistId)
      .first<{ x: number }>()
    if (!exists) return false
    if (fields.titel !== undefined) {
      await db
        .prepare(
          'UPDATE checklisten_kategorien SET titel = ? WHERE id = ? AND checklist_id = ?'
        )
        .bind(fields.titel.trim(), id, checklistId)
        .run()
    }
    if (fields.reihenfolge !== undefined) {
      await db
        .prepare(
          'UPDATE checklisten_kategorien SET reihenfolge = ? WHERE id = ? AND checklist_id = ?'
        )
        .bind(fields.reihenfolge, id, checklistId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error updateChecklisteKategorie:', error)
    return false
  }
}

export async function deleteChecklisteKategorie(
  db: D1Database,
  checklistId: string,
  id: string
): Promise<boolean> {
  try {
    const r = await db
      .prepare('DELETE FROM checklisten_kategorien WHERE id = ? AND checklist_id = ?')
      .bind(id, checklistId)
      .run()
    return r.success && (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error deleteChecklisteKategorie:', error)
    return false
  }
}

export async function reorderChecklisteKategorien(
  db: D1Database,
  checklistId: string,
  orderedIds: string[]
): Promise<boolean> {
  try {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .prepare(
          'UPDATE checklisten_kategorien SET reihenfolge = ? WHERE id = ? AND checklist_id = ?'
        )
        .bind(i, orderedIds[i], checklistId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error reorderChecklisteKategorien:', error)
    return false
  }
}

export async function createChecklisteEintrag(
  db: D1Database,
  checklistId: string,
  kategorieId: string,
  text: string
): Promise<string | null> {
  try {
    const cat = await db
      .prepare('SELECT checklist_id FROM checklisten_kategorien WHERE id = ?')
      .bind(kategorieId)
      .first<{ checklist_id: string }>()
    if (!cat || cat.checklist_id !== checklistId) return null
    const id = crypto.randomUUID()
    const maxRow = await db
      .prepare(
        'SELECT MAX(reihenfolge) as m FROM checklisten_eintraege WHERE kategorie_id = ?'
      )
      .bind(kategorieId)
      .first<{ m: number | null }>()
    const reihenfolge = (maxRow?.m ?? -1) + 1
    await db
      .prepare(
        `INSERT INTO checklisten_eintraege (id, checklist_id, kategorie_id, text, reihenfolge, erledigt)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .bind(id, checklistId, kategorieId, text.trim(), reihenfolge)
      .run()
    return id
  } catch (error) {
    console.error('Error createChecklisteEintrag:', error)
    return null
  }
}

export async function updateChecklisteEintrag(
  db: D1Database,
  checklistId: string,
  id: string,
  fields: { text?: string; kategorie_id?: string; reihenfolge?: number }
): Promise<boolean> {
  try {
    const row = await db
      .prepare('SELECT checklist_id, kategorie_id FROM checklisten_eintraege WHERE id = ?')
      .bind(id)
      .first<{ checklist_id: string; kategorie_id: string }>()
    if (!row || row.checklist_id !== checklistId) return false
    if (fields.text !== undefined) {
      await db
        .prepare('UPDATE checklisten_eintraege SET text = ? WHERE id = ? AND checklist_id = ?')
        .bind(fields.text.trim(), id, checklistId)
        .run()
    }
    if (fields.kategorie_id !== undefined) {
      const cat = await db
        .prepare('SELECT checklist_id FROM checklisten_kategorien WHERE id = ?')
        .bind(fields.kategorie_id)
        .first<{ checklist_id: string }>()
      if (!cat || cat.checklist_id !== checklistId) return false
      await db
        .prepare(
          'UPDATE checklisten_eintraege SET kategorie_id = ? WHERE id = ? AND checklist_id = ?'
        )
        .bind(fields.kategorie_id, id, checklistId)
        .run()
    }
    if (fields.reihenfolge !== undefined) {
      await db
        .prepare(
          'UPDATE checklisten_eintraege SET reihenfolge = ? WHERE id = ? AND checklist_id = ?'
        )
        .bind(fields.reihenfolge, id, checklistId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error updateChecklisteEintrag:', error)
    return false
  }
}

export async function deleteChecklisteEintrag(
  db: D1Database,
  checklistId: string,
  id: string
): Promise<boolean> {
  try {
    const r = await db
      .prepare('DELETE FROM checklisten_eintraege WHERE id = ? AND checklist_id = ?')
      .bind(id, checklistId)
      .run()
    return r.success
  } catch (error) {
    console.error('Error deleteChecklisteEintrag:', error)
    return false
  }
}

export async function reorderChecklisteEintraege(
  db: D1Database,
  checklistId: string,
  updates: { id: string; kategorie_id: string; reihenfolge: number }[]
): Promise<boolean> {
  try {
    for (const u of updates) {
      const row = await db
        .prepare('SELECT checklist_id FROM checklisten_eintraege WHERE id = ?')
        .bind(u.id)
        .first<{ checklist_id: string }>()
      if (!row || row.checklist_id !== checklistId) return false
      const cat = await db
        .prepare('SELECT checklist_id FROM checklisten_kategorien WHERE id = ?')
        .bind(u.kategorie_id)
        .first<{ checklist_id: string }>()
      if (!cat || cat.checklist_id !== checklistId) return false
    }
    for (const u of updates) {
      await db
        .prepare(
          `UPDATE checklisten_eintraege SET kategorie_id = ?, reihenfolge = ?
           WHERE id = ? AND checklist_id = ?`
        )
        .bind(u.kategorie_id, u.reihenfolge, u.id, checklistId)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error reorderChecklisteEintraege:', error)
    return false
  }
}

export async function setChecklisteEintragErledigt(
  db: D1Database,
  checklistId: string,
  eintragId: string,
  erledigt: boolean
): Promise<boolean> {
  try {
    const r = await db
      .prepare(
        `UPDATE checklisten_eintraege SET erledigt = ? WHERE id = ? AND checklist_id = ?`
      )
      .bind(erledigt ? 1 : 0, eintragId, checklistId)
      .run()
    return r.success && (r.meta?.changes ?? 0) > 0
  } catch (error) {
    console.error('Error setChecklisteEintragErledigt:', error)
    return false
  }
}

export async function resetChecklisteErledigt(db: D1Database, checklistId: string): Promise<boolean> {
  try {
    await db
      .prepare(
        'UPDATE checklisten_eintraege SET erledigt = 0 WHERE checklist_id = ?'
      )
      .bind(checklistId)
      .run()
    return true
  } catch (error) {
    console.error('Error resetChecklisteErledigt:', error)
    return false
  }
}
