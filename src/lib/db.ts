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
  abfahrtdatum?: string | null
  enddatum: string
  reiseziel_name: string
  reiseziel_adresse?: string | null
  land_region?: string | null
  created_at: string
}

export interface PackingItem {
  id: string
  packliste_id: string
  gegenstand_id: string
  anzahl: number
  gepackt: boolean
  bemerkung?: string | null
  transport_id?: string | null
  transport_name?: string
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte'
  mitreisende?: PackingItemMitreisender[] // Zugeordnete Mitreisende mit Gepackt-Status
  was: string // Gejoint aus ausruestungsgegenstaende
  kategorie: string // Gejoint
  hauptkategorie: string // Gejoint
  details?: string
  einzelgewicht?: number
  created_at: string
}

export interface PackingItemMitreisender {
  mitreisender_id: string
  mitreisender_name: string
  gepackt: boolean
}

export interface Mitreisender {
  id: string
  name: string
  user_id?: string | null
  is_default_member: boolean
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
  mitreisenden_typ: 'pauschal' | 'alle' | 'ausgewaehlte'
  standard_mitreisende?: string[] // IDs der standardmäßig zugeordneten Mitreisenden
  links?: EquipmentLink[]
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
  created_at: string
}

export interface Category {
  id: string
  titel: string
  hauptkategorie_id: string
  reihenfolge: number
}

export interface MainCategory {
  id: string
  titel: string
  reihenfolge: number
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
  vacation: { 
    titel: string
    startdatum: string
    abfahrtdatum?: string | null
    enddatum: string
    reiseziel_name: string
    reiseziel_adresse?: string | null
    land_region?: string | null
  }
): Promise<Vacation | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO urlaube (id, titel, startdatum, abfahrtdatum, enddatum, reiseziel_name, reiseziel_adresse, land_region) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id, 
        vacation.titel, 
        vacation.startdatum, 
        vacation.abfahrtdatum || null,
        vacation.enddatum, 
        vacation.reiseziel_name,
        vacation.reiseziel_adresse || null,
        vacation.land_region || null
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

/**
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
 */
export async function getPackingItems(db: D1Database, vacationId: string): Promise<PackingItem[]> {
  try {
    // Wir müssen über die packlisten Tabelle gehen
    const query = `
      SELECT 
        pe.id, pe.packliste_id, pe.gegenstand_id, pe.anzahl, pe.gepackt, pe.bemerkung, pe.transport_id,
        ag.was, ag.einzelgewicht, ag.details, ag.mitreisenden_typ,
        k.titel as kategorie,
        hk.titel as hauptkategorie,
        t.name as transport_name,
        pe.created_at
      FROM packlisten_eintraege pe
      JOIN packlisten p ON pe.packliste_id = p.id
      JOIN ausruestungsgegenstaende ag ON pe.gegenstand_id = ag.id
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN transportmittel t ON pe.transport_id = t.id
      WHERE p.urlaub_id = ?
      ORDER BY hk.reihenfolge, k.reihenfolge, ag.was
    `
    const result = await db.prepare(query).bind(vacationId).all<Record<string, unknown>>()
    
    // Konvertiere 0/1 zu boolean für gepackt und lade Mitreisende
    const items = await Promise.all(
      (result.results || []).map(async (item) => {
        // Lade zugeordnete Mitreisende mit Gepackt-Status
        const mitreisende = await db
          .prepare(`
            SELECT m.id as mitreisender_id, m.name as mitreisender_name, pem.gepackt
            FROM packlisten_eintrag_mitreisende pem
            JOIN mitreisende m ON pem.mitreisender_id = m.id
            WHERE pem.packlisten_eintrag_id = ?
            ORDER BY m.name
          `)
          .bind(item.id)
          .all<{ mitreisender_id: string; mitreisender_name: string; gepackt: number }>()
        
        return {
          id: String(item.id),
          packliste_id: String(item.packliste_id),
          gegenstand_id: String(item.gegenstand_id),
          anzahl: Number(item.anzahl),
          gepackt: !!item.gepackt,
          bemerkung: item.bemerkung ? String(item.bemerkung) : null,
          transport_id: item.transport_id ? String(item.transport_id) : undefined,
          transport_name: item.transport_name ? String(item.transport_name) : undefined,
          mitreisenden_typ: String(item.mitreisenden_typ || 'pauschal') as 'pauschal' | 'alle' | 'ausgewaehlte',
          mitreisende: (mitreisende.results || []).map(m => ({
            mitreisender_id: m.mitreisender_id,
            mitreisender_name: m.mitreisender_name,
            gepackt: !!m.gepackt
          })),
          was: String(item.was),
          kategorie: String(item.kategorie),
          hauptkategorie: String(item.hauptkategorie),
          details: item.details ? String(item.details) : undefined,
          einzelgewicht: item.einzelgewicht ? Number(item.einzelgewicht) : undefined,
          created_at: String(item.created_at || '')
        }
      })
    )
    
    return items
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
  updates: { gepackt?: boolean; anzahl?: number; bemerkung?: string | null }
): Promise<boolean> {
  try {
    const fields: string[] = []
    const values: (string | number)[] = []

    if (updates.gepackt !== undefined) {
      fields.push('gepackt = ?')
      values.push(updates.gepackt ? 1 : 0)
    }
    if (updates.anzahl !== undefined) {
      fields.push('anzahl = ?')
      values.push(updates.anzahl)
    }
    if (updates.bemerkung !== undefined) {
      fields.push('bemerkung = ?')
      values.push(updates.bemerkung || '')
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
        hk.titel as hauptkategorie_titel,
        t.name as transport_name
      FROM ausruestungsgegenstaende ag
      JOIN kategorien k ON ag.kategorie_id = k.id
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      LEFT JOIN transportmittel t ON ag.transport_id = t.id
      ORDER BY hk.reihenfolge, k.reihenfolge, ag.was
    `
    const items = await db.prepare(query).all<EquipmentItem>()
    
    // Fetch links and standard mitreisende for all equipment items
    const itemsWithDetails = await Promise.all(
      (items.results || []).map(async (item) => {
        const links = await db.prepare(
          'SELECT * FROM ausruestungsgegenstaende_links WHERE gegenstand_id = ?'
        ).bind(item.id).all<EquipmentLink>()
        
        const standardMitreisende = await db.prepare(
          'SELECT mitreisender_id FROM ausruestungsgegenstaende_standard_mitreisende WHERE gegenstand_id = ?'
        ).bind(item.id).all<{ mitreisender_id: string }>()
        
        return { 
          ...item, 
          links: links.results || [],
          standard_mitreisende: standardMitreisende.results?.map(m => m.mitreisender_id) || []
        }
      })
    )
    
    return itemsWithDetails
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
    const item = await db.prepare(query).bind(id).first<EquipmentItem>()
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
      links: links.results || [],
      standard_mitreisende: standardMitreisende.results?.map(m => m.mitreisender_id) || []
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
    mitreisenden_typ?: 'pauschal' | 'alle' | 'ausgewaehlte'
    standard_mitreisende?: string[]
    links?: string[]
  }
): Promise<EquipmentItem | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        `INSERT INTO ausruestungsgegenstaende 
         (id, was, kategorie_id, transport_id, einzelgewicht, standard_anzahl, status, details, mitreisenden_typ) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        item.mitreisenden_typ || 'pauschal'
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
    mitreisenden_typ?: 'pauschal' | 'alle' | 'ausgewaehlte'
    standard_mitreisende?: string[]
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
    const result = await db.prepare('SELECT id, titel, reihenfolge FROM hauptkategorien ORDER BY reihenfolge').all<MainCategory>()
    return result.results || []
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
        hk.titel as hauptkategorie_titel
      FROM kategorien k
      JOIN hauptkategorien hk ON k.hauptkategorie_id = hk.id
      ORDER BY hk.reihenfolge, k.reihenfolge
    `
    const result = await db.prepare(query).all<Category & { hauptkategorie_titel: string }>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching categories with main categories:', error)
    return []
  }
}

/**
 * Abrufen aller Transportmittel
 */
export async function getTransportVehicles(db: D1Database): Promise<TransportVehicle[]> {
  try {
    const result = await db.prepare('SELECT * FROM transportmittel ORDER BY name').all<TransportVehicle>()
    return result.results || []
  } catch (error) {
    console.error('Error fetching transport vehicles:', error)
    return []
  }
}

/**
 * Hinzufügen eines Gegenstands zur Packliste
 */
export async function addPackingItem(
  db: D1Database,
  packlisteId: string,
  gegenstandId: string,
  anzahl: number,
  bemerkung?: string | null,
  transportId?: string | null,
  mitreisende?: string[]
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
      for (const mitreisenderId of mitreisende) {
        await db
          .prepare('INSERT INTO packlisten_eintrag_mitreisende (packlisten_eintrag_id, mitreisender_id, gepackt) VALUES (?, ?, ?)')
          .bind(id, mitreisenderId, 0)
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
 * Löschen eines Packartikels
 */
export async function deletePackingItem(db: D1Database, id: string): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM packlisten_eintraege WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting packing item:', error)
    return false
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
    const result = await db.prepare('SELECT * FROM mitreisende ORDER BY name').all<Mitreisender>()
    return result.results || []
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
    const result = await db
      .prepare(`
        SELECT m.* 
        FROM mitreisende m
        INNER JOIN urlaub_mitreisende um ON m.id = um.mitreisender_id
        WHERE um.urlaub_id = ?
        ORDER BY m.name
      `)
      .bind(vacationId)
      .all<Mitreisender>()
    return result.results || []
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
  isDefaultMember: boolean = false
): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare('INSERT INTO mitreisende (id, name, user_id, is_default_member) VALUES (?, ?, ?, ?)')
      .bind(id, name, userId || null, isDefaultMember ? 1 : 0)
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
  isDefaultMember?: boolean
): Promise<boolean> {
  try {
    await db
      .prepare('UPDATE mitreisende SET name = ?, user_id = ?, is_default_member = ? WHERE id = ?')
      .bind(name, userId || null, isDefaultMember ? 1 : 0, id)
      .run()
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

/**
 * Abhaken eines Packlisten-Eintrags für einen bestimmten Mitreisenden
 */
export async function togglePackingItemForMitreisender(
  db: D1Database,
  packlistenEintragId: string,
  mitreisenderId: string,
  gepackt: boolean
): Promise<boolean> {
  try {
    // Prüfen, ob bereits ein Eintrag existiert
    const existing = await db
      .prepare('SELECT gepackt FROM packlisten_eintrag_mitreisende WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?')
      .bind(packlistenEintragId, mitreisenderId)
      .first<{ gepackt: number }>()
    
    if (existing) {
      // Update
      await db
        .prepare('UPDATE packlisten_eintrag_mitreisende SET gepackt = ? WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?')
        .bind(gepackt ? 1 : 0, packlistenEintragId, mitreisenderId)
        .run()
    } else {
      // Insert
      await db
        .prepare('INSERT INTO packlisten_eintrag_mitreisende (packlisten_eintrag_id, mitreisender_id, gepackt) VALUES (?, ?, ?)')
        .bind(packlistenEintragId, mitreisenderId, gepackt ? 1 : 0)
        .run()
    }
    return true
  } catch (error) {
    console.error('Error toggling packing item for mitreisender:', error)
    return false
  }
}
