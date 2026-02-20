-- Migration: Transportmittel Festgewicht
-- Datum: 2026-02-20
-- Beschreibung: Manuelle Festgewicht-Einträge und Option "Fest installierte Ausrüstung mitrechnen"

-- 1. Neue Spalte bei transportmittel
ALTER TABLE transportmittel ADD COLUMN fest_installiert_mitrechnen INTEGER NOT NULL DEFAULT 0;

-- 2. Tabelle für manuelle Festgewicht-Einträge
CREATE TABLE IF NOT EXISTS transportmittel_festgewicht_manuell (
    id TEXT PRIMARY KEY,
    transport_id TEXT NOT NULL,
    titel TEXT NOT NULL,
    gewicht REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (gewicht >= 0),
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE CASCADE
);

CREATE INDEX idx_transportmittel_festgewicht_manuell_transport_id ON transportmittel_festgewicht_manuell(transport_id);
