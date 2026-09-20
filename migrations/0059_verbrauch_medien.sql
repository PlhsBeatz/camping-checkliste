-- Migration 0059: Verbrauch – konfigurierbare Medien + CHECK auf typ lockern
-- Lokal:  npx wrangler d1 migrations apply camping-db --local
-- Remote: npx wrangler d1 migrations apply camping-db --remote

CREATE TABLE IF NOT EXISTS verbrauch_medien (
    id TEXT PRIMARY KEY,
    schluessel TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    einheit TEXT NOT NULL DEFAULT 'kg',
    messmodus TEXT NOT NULL DEFAULT 'abnahme'
        CHECK (messmodus IN ('abnahme', 'zunahme')),
    label_wert_start TEXT NOT NULL DEFAULT 'Anfang',
    label_wert_ende TEXT NOT NULL DEFAULT 'Ende',
    ist_aktiv INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_verbrauch_medien_aktiv_sort
    ON verbrauch_medien(ist_aktiv, sort_order, name);

CREATE TRIGGER IF NOT EXISTS update_verbrauch_medien_timestamp
AFTER UPDATE ON verbrauch_medien
BEGIN
  UPDATE verbrauch_medien SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Gas als aktives Medium (bestehende Messungen bleiben sichtbar)
INSERT OR IGNORE INTO verbrauch_medien (
    id, schluessel, name, einheit, messmodus,
    label_wert_start, label_wert_ende, ist_aktiv, sort_order
) VALUES (
    'gas',
    'gas',
    'Gas',
    'kg',
    'abnahme',
    'Gewicht Anfang',
    'Gewicht Ende',
    1,
    10
);

-- typ-CHECK entfernen (Validierung in der App gegen verbrauch_medien)
PRAGMA foreign_keys=OFF;

CREATE TABLE verbrauch_messungen_new (
    id TEXT PRIMARY KEY,
    typ TEXT NOT NULL DEFAULT 'gas',
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

INSERT INTO verbrauch_messungen_new (
    id, typ, urlaub_id, equipment_id, transport_id,
    messdatum_start, messdatum_ende, wert_start, wert_ende, einheit,
    verbrauch_gesamt, verbrauch_pro_tag, notizen, created_at
)
SELECT
    id, typ, urlaub_id, equipment_id, transport_id,
    messdatum_start, messdatum_ende, wert_start, wert_ende, einheit,
    verbrauch_gesamt, verbrauch_pro_tag, notizen, created_at
FROM verbrauch_messungen;

DROP TABLE verbrauch_messungen;
ALTER TABLE verbrauch_messungen_new RENAME TO verbrauch_messungen;

CREATE INDEX IF NOT EXISTS idx_verbrauch_urlaub ON verbrauch_messungen(urlaub_id);
CREATE INDEX IF NOT EXISTS idx_verbrauch_typ ON verbrauch_messungen(typ);

PRAGMA foreign_keys=ON;
