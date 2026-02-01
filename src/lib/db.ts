/**
 * Datenbank-Adapter für Cloudflare D1
 * Dieser Adapter bietet Funktionen für die Interaktion mit der D1-Datenbank
 * unter Verwendung der deutschen Tabellennamen aus dem ursprünglichen Schema.
 */

import { D1Database } from '@cloudflare/workers-types'

export interface Vacation {
  id: string
  titel: string
  startdatum: string
  enddatum: string
  reiseziel_name: string
  created_at: string
}

export interface PackingItem {
  id: string
  packliste_id: string
  gegenstand_id: string
  anzahl: number
  gepackt: boolean
  was: string // Gejoint aus ausruestungsgegenstaende
  kategorie: string // Gejoint
  hauptkategorie: string // Gejoint
  details?: string
  einzelgewicht?: number
  created_at: string
}

export interface EquipmentItem {
  id: string
  was: string
  kategorie_id: string
  kategorie_titel?: string
  hauptkategorie_titel?: string
  einzelgewicht: number
  standard_anzahl: number
  status: string
  details: string
  created_at: string
}

export interface CloudflareEnv {
  DB: D1Database
}

/**
 * Hilfsfunktion zum Abrufen der D1-Datenbank aus dem Kontext
 */
export function getDB(env: CloudflareEnv): D1Database {
  if (!env.DB) {
    throw new Error('D1 Database binding not found. Make sure DB is bound in wrangler.toml')
  }
  return env.DB
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
 */
export async function getVacations(db: D1Database): Promise<Vacation[]> {
  try {
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
  vacation: { titel: string; startdatum: string; enddatum: string; reiseziel_name: string }
): Promise<Vacation | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO urlaube (id, titel, startdatum, enddatum, reiseziel_name) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(id, vacation.titel, vacation.startdatum, vacation.enddatum, vacation.reiseziel_name)
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
 * Abrufen aller Packartikel für eine Urlaubsreise
 */
export async function getPackingItems(db: D1Database, vacationId: string): Promise<PackingItem[]> {
  try {
    // Wir müssen über die packlisten Tabelle gehen
    const query = `
      SELECT 
        pe.id, pe.packliste_id, pe.gegenstand_id, pe.anzahl, pe.gepackt, pe.bemerkung as details,
        ag.was, ag.einzelgewicht,
        k.titel as kategorie,
        hk.titel as hauptkategorie
      FROM packlisten_eintraege pe
      JOIN packlisten p ON pe.packliste_id = p.id
      JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      WHERE p.urlaub_id = ?
      ORDER BY hk.reihenfolge, k.reihenfolge, ag.was
    `
    const result = await db.prepare(query).bind(vacationId).all<Record<string, unknown>>()
    
    // Konvertiere 0/1 zu boolean für gepackt
    return (result.results || []).map((item) => ({
      id: String(item.id),
      packliste_id: String(item.packliste_id),
      gegenstand_id: String(item.gegenstand_id),
      anzahl: Number(item.anzahl),
      gepackt: !!item.gepackt,
      was: String(item.was),
      kategorie: String(item.kategorie),
      hauptkategorie: String(item.hauptkategorie),
      details: item.details ? String(item.details) : undefined,
      einzelgewicht: item.einzelgewicht ? Number(item.einzelgewicht) : undefined,
      created_at: String(item.created_at || '')
    }))
  } catch (error) {
    console.error('Error fetching packing items:', error)
    return []
  }
}

/**
 * Aktualisieren eines Packartikels
 */
export async function updatePackingItem(
  db: D1Database,
  id: string,
  updates: { gepackt?: boolean; anzahl?: number }
): Promise<boolean> {
  try {
    const fields = []
    const values: (string | number)[] = []

    if (updates.gepackt !== undefined) {
      fields.push('gepackt = ?')
      values.push(updates.gepackt ? 1 : 0)
    }
    if (updates.anzahl !== undefined) {
      fields.push('anzahl = ?')
      values.push(updates.anzahl)
    }

    if (fields.length === 0) return true

    values.push(id)
    const query = `UPDATE packlisten_eintraege SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    await db.prepare(query).bind(...values).run()
    return true
  } catch (error) {
    console.error('Error updating packing item:', error)
    return false
  }
}

/**
 * Abrufen aller Ausrüstungsgegenstände
 */
export async function getEquipmentItems(db: D1Database): Promise<EquipmentItem[]> {
  try {
    const query = `
      SELECT 
        ag.*, 
        k.titel as kategorie_titel,
        hk.titel as hauptkategorie_titel
      FROM ausruestungsgegenstaende ag
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      ORDER BY hk.reihenfolge, k.reihenfolge, ag.was
    `
    const result = await db.prepare(query).all<EquipmentItem>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching equipment items:', error)
    return []
  }
}
