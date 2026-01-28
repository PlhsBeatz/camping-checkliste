/**
 * Datenbank-Adapter für Cloudflare D1
 * Dieser Adapter bietet Funktionen für die Interaktion mit der D1-Datenbank
 */

export interface Vacation {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: string
  createdAt: string
}

export interface PackingItem {
  id: string
  vacationId: string
  name: string
  quantity: number
  isPacked: boolean
  category: string
  mainCategory: string
  details?: string
  weight?: number
  createdAt: string
}

export interface EquipmentItem {
  id: string
  title: string
  category: string
  mainCategory: string
  weight: number
  defaultQuantity: number
  status: string
  details: string
  links: string
  createdAt: string
}

/**
 * Hilfsfunktion zum Abrufen der D1-Datenbank aus dem Kontext
 * Diese wird von Cloudflare Pages automatisch bereitgestellt
 */
export function getDB(env: any) {
  if (!env.DB) {
    throw new Error('D1 Database binding not found. Make sure DB is bound in wrangler.toml')
  }
  return env.DB
}

/**
 * Initialisiert die Datenbank mit dem Schema
 */
export async function initializeDatabase(db: any) {
  try {
    // Prüfen, ob die Tabellen bereits existieren
    const tables = await db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='vacations'"
    ).all()

    if (tables.results.length === 0) {
      // Tabellen erstellen
      await db.exec(`
        CREATE TABLE IF NOT EXISTS vacations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          destination TEXT NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          travelers TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS packing_items (
          id TEXT PRIMARY KEY,
          vacationId TEXT NOT NULL,
          name TEXT NOT NULL,
          quantity INTEGER DEFAULT 1,
          isPacked INTEGER DEFAULT 0,
          category TEXT NOT NULL,
          mainCategory TEXT NOT NULL,
          details TEXT,
          weight REAL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (vacationId) REFERENCES vacations(id)
        );

        CREATE TABLE IF NOT EXISTS equipment_items (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          mainCategory TEXT NOT NULL,
          weight REAL NOT NULL,
          defaultQuantity INTEGER DEFAULT 1,
          status TEXT,
          details TEXT,
          links TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX idx_packing_vacation ON packing_items(vacationId);
        CREATE INDEX idx_equipment_category ON equipment_items(mainCategory);
      `)
    }
  } catch (error) {
    console.error('Database initialization error:', error)
  }
}

/**
 * Abrufen aller Urlaubsreisen
 */
export async function getVacations(db: any): Promise<Vacation[]> {
  try {
    const result = await db.prepare('SELECT * FROM vacations ORDER BY startDate DESC').all()
    return result.results || []
  } catch (error) {
    console.error('Error fetching vacations:', error)
    return []
  }
}

/**
 * Abrufen einer einzelnen Urlaubsreise
 */
export async function getVacation(db: any, id: string): Promise<Vacation | null> {
  try {
    const result = await db.prepare('SELECT * FROM vacations WHERE id = ?').bind(id).first()
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
  db: any,
  vacation: Omit<Vacation, 'id' | 'createdAt'>
): Promise<Vacation | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO vacations (id, title, destination, startDate, endDate, travelers) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(id, vacation.title, vacation.destination, vacation.startDate, vacation.endDate, vacation.travelers)
      .run()

    return getVacation(db, id)
  } catch (error) {
    console.error('Error creating vacation:', error)
    return null
  }
}

/**
 * Abrufen aller Packartikel für eine Urlaubsreise
 */
export async function getPackingItems(db: any, vacationId: string): Promise<PackingItem[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM packing_items WHERE vacationId = ? ORDER BY mainCategory, category')
      .bind(vacationId)
      .all()
    return result.results || []
  } catch (error) {
    console.error('Error fetching packing items:', error)
    return []
  }
}

/**
 * Erstellen eines neuen Packartikels
 */
export async function createPackingItem(
  db: any,
  item: Omit<PackingItem, 'id' | 'createdAt'>
): Promise<PackingItem | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO packing_items (id, vacationId, name, quantity, isPacked, category, mainCategory, details, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        item.vacationId,
        item.name,
        item.quantity,
        item.isPacked ? 1 : 0,
        item.category,
        item.mainCategory,
        item.details || null,
        item.weight || null
      )
      .run()

    return db.prepare('SELECT * FROM packing_items WHERE id = ?').bind(id).first()
  } catch (error) {
    console.error('Error creating packing item:', error)
    return null
  }
}

/**
 * Aktualisieren eines Packartikels
 */
export async function updatePackingItem(
  db: any,
  id: string,
  updates: Partial<PackingItem>
): Promise<boolean> {
  try {
    const fields = []
    const values = []

    if (updates.isPacked !== undefined) {
      fields.push('isPacked = ?')
      values.push(updates.isPacked ? 1 : 0)
    }
    if (updates.quantity !== undefined) {
      fields.push('quantity = ?')
      values.push(updates.quantity)
    }
    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }

    if (fields.length === 0) return true

    values.push(id)
    const query = `UPDATE packing_items SET ${fields.join(', ')} WHERE id = ?`
    await db.prepare(query).bind(...values).run()
    return true
  } catch (error) {
    console.error('Error updating packing item:', error)
    return false
  }
}

/**
 * Löschen eines Packartikels
 */
export async function deletePackingItem(db: any, id: string): Promise<boolean> {
  try {
    await db.prepare('DELETE FROM packing_items WHERE id = ?').bind(id).run()
    return true
  } catch (error) {
    console.error('Error deleting packing item:', error)
    return false
  }
}

/**
 * Abrufen aller Ausrüstungsgegenstände
 */
export async function getEquipmentItems(db: any): Promise<EquipmentItem[]> {
  try {
    const result = await db.prepare('SELECT * FROM equipment_items ORDER BY mainCategory, category').all()
    return result.results || []
  } catch (error) {
    console.error('Error fetching equipment items:', error)
    return []
  }
}

/**
 * Erstellen eines neuen Ausrüstungsgegenstands
 */
export async function createEquipmentItem(
  db: any,
  item: Omit<EquipmentItem, 'id' | 'createdAt'>
): Promise<EquipmentItem | null> {
  try {
    const id = crypto.randomUUID()
    await db
      .prepare(
        'INSERT INTO equipment_items (id, title, category, mainCategory, weight, defaultQuantity, status, details, links) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        id,
        item.title,
        item.category,
        item.mainCategory,
        item.weight,
        item.defaultQuantity,
        item.status,
        item.details,
        item.links
      )
      .run()

    return db.prepare('SELECT * FROM equipment_items WHERE id = ?').bind(id).first()
  } catch (error) {
    console.error('Error creating equipment item:', error)
    return null
  }
}
