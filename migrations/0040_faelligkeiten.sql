-- Migration 0040: Wartung – Fälligkeiten und Historie
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0040_faelligkeiten.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0040_faelligkeiten.sql

CREATE TABLE IF NOT EXISTS faelligkeiten (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kategorie TEXT NOT NULL DEFAULT 'sonstiges'
        CHECK (kategorie IN ('sicherheit', 'fahrzeug', 'ausruestung', 'versicherung', 'sonstiges')),
    typ TEXT NOT NULL DEFAULT 'festes_datum'
        CHECK (typ IN ('festes_datum', 'intervall', 'alter_anzeige', 'historie_mit_intervall')),
    equipment_id TEXT,
    transport_id TEXT,
    bezug_datum TEXT,
    gueltig_bis TEXT,
    letzte_erledigung_am TEXT,
    naechste_faelligkeit TEXT,
    intervall_einheit TEXT CHECK (intervall_einheit IS NULL OR intervall_einheit IN ('tage', 'monate', 'jahre')),
    intervall_wert INTEGER,
    warnung_tage_vorher INTEGER NOT NULL DEFAULT 30,
    sicherheitsrelevant INTEGER NOT NULL DEFAULT 0,
    quittierung_erforderlich INTEGER NOT NULL DEFAULT 0,
    push_reminder_sent INTEGER NOT NULL DEFAULT 0,
    notizen TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (equipment_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE SET NULL,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS faelligkeiten_historie (
    id TEXT PRIMARY KEY,
    faelligkeit_id TEXT NOT NULL,
    ereignis_typ TEXT NOT NULL CHECK (ereignis_typ IN ('erledigt', 'quittiert', 'notiz')),
    datum TEXT NOT NULL,
    user_id TEXT,
    notiz TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (faelligkeit_id) REFERENCES faelligkeiten(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_faelligkeiten_naechste ON faelligkeiten(naechste_faelligkeit);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_equipment ON faelligkeiten(equipment_id);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_transport ON faelligkeiten(transport_id);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_archived ON faelligkeiten(is_archived);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_historie_faelligkeit ON faelligkeiten_historie(faelligkeit_id, datum);

CREATE TRIGGER IF NOT EXISTS update_faelligkeiten_timestamp
AFTER UPDATE ON faelligkeiten
BEGIN
  UPDATE faelligkeiten SET updated_at = datetime('now') WHERE id = NEW.id;
END;
