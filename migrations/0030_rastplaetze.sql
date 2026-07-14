-- Migration 0030: Rastplätze (Pausenplätze, Tankstellen, Parkplätze etc.)
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0030_rastplaetze.sql

CREATE TABLE IF NOT EXISTS rastplaetze (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    bewertung TEXT NOT NULL CHECK (bewertung IN ('empfehlung', 'no_go')),
    kategorie TEXT NOT NULL CHECK (kategorie IN ('rastplatz', 'tankstelle', 'parkplatz', 'autohof', 'restaurant', 'sonstiges')),
    merkmale TEXT,
    bemerkungen TEXT,
    adresse TEXT,
    ort TEXT,
    land TEXT,
    bundesland TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    google_place_id TEXT,
    entdeckt_urlaub_id TEXT,
    entdeckt_am TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (entdeckt_urlaub_id) REFERENCES urlaube(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rastplaetze_is_archived ON rastplaetze(is_archived);
CREATE INDEX IF NOT EXISTS idx_rastplaetze_bewertung ON rastplaetze(bewertung);
CREATE INDEX IF NOT EXISTS idx_rastplaetze_kategorie ON rastplaetze(kategorie);
CREATE INDEX IF NOT EXISTS idx_rastplaetze_land ON rastplaetze(land);
CREATE INDEX IF NOT EXISTS idx_rastplaetze_coords ON rastplaetze(lat, lng);
