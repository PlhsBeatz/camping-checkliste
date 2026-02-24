-- Migration 0013: Campingplätze, Routen-Cache und User-Heimatadresse
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0013_campingplaetze_and_routes.sql

-- User-Heimatadresse für Routenberechnung
ALTER TABLE users ADD COLUMN heimat_adresse TEXT;
ALTER TABLE users ADD COLUMN heimat_lat REAL;
ALTER TABLE users ADD COLUMN heimat_lng REAL;

-- Campingplätze (Merkliste / Urlaubsplätze)
CREATE TABLE IF NOT EXISTS campingplaetze (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    land TEXT NOT NULL,
    bundesland TEXT,
    ort TEXT NOT NULL,
    webseite TEXT,
    video_link TEXT,
    platz_typ TEXT NOT NULL CHECK (platz_typ IN ('Durchreise', 'Urlaubsplatz', 'Stellplatz')),
    pros TEXT,
    cons TEXT,
    adresse TEXT,
    lat REAL,
    lng REAL,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campingplaetze_is_archived ON campingplaetze(is_archived);
CREATE INDEX IF NOT EXISTS idx_campingplaetze_ort ON campingplaetze(ort);
CREATE INDEX IF NOT EXISTS idx_campingplaetze_land ON campingplaetze(land);

-- n:m-Verknüpfung Urlaube <-> Campingplätze
CREATE TABLE IF NOT EXISTS urlaub_campingplaetze (
    urlaub_id TEXT NOT NULL,
    campingplatz_id TEXT NOT NULL,
    notizen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (urlaub_id, campingplatz_id),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE,
    FOREIGN KEY (campingplatz_id) REFERENCES campingplaetze(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_urlaub_campingplaetze_urlaub_id ON urlaub_campingplaetze(urlaub_id);
CREATE INDEX IF NOT EXISTS idx_urlaub_campingplaetze_campingplatz_id ON urlaub_campingplaetze(campingplatz_id);

-- Routen-Cache pro Benutzer und Campingplatz
CREATE TABLE IF NOT EXISTS campingplatz_routen_cache (
    user_id TEXT NOT NULL,
    campingplatz_id TEXT NOT NULL,
    distance_km REAL NOT NULL,
    duration_min REAL NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'haversine')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, campingplatz_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (campingplatz_id) REFERENCES campingplaetze(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campingplatz_routen_cache_user ON campingplatz_routen_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_campingplatz_routen_cache_campingplatz ON campingplatz_routen_cache(campingplatz_id);

