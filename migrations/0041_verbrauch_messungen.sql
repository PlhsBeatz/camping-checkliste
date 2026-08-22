-- Migration 0041: Wartung – Verbrauchsmessungen
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0041_verbrauch_messungen.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0041_verbrauch_messungen.sql

CREATE TABLE IF NOT EXISTS verbrauch_messungen (
    id TEXT PRIMARY KEY,
    typ TEXT NOT NULL DEFAULT 'gas'
        CHECK (typ IN ('gas', 'wasser', 'strom', 'adblue', 'sonstiges')),
    urlaub_id TEXT,
    equipment_id TEXT,
    transport_id TEXT,
    messdatum_start TEXT,
    messdatum_ende TEXT,
    wert_start REAL,
    wert_ende REAL,
    einheit TEXT NOT NULL DEFAULT 'kg',
    verbrauch_gesamt REAL,
    verbrauch_pro_tag REAL,
    notizen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE SET NULL,
    FOREIGN KEY (equipment_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE SET NULL,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_verbrauch_urlaub ON verbrauch_messungen(urlaub_id);
CREATE INDEX IF NOT EXISTS idx_verbrauch_typ ON verbrauch_messungen(typ);
