-- Migration 0025: Campingplatz-Dauern (Start/Ende) pro Zuordnung + Mehrfachzuordnung
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0025_urlaub_campingplaetze_dauer.sql
--
-- Bisher: urlaub_campingplaetze mit zusammengesetztem PK (urlaub_id, campingplatz_id)
--         -> ein Campingplatz konnte je Urlaub nur einmal und ohne Datum zugeordnet werden.
-- Neu:    Surrogat-Schlüssel `id`, optionale start_datum/end_datum je Zuordnung,
--         Mehrfachzuordnung desselben Campingplatzes je Urlaub möglich.
--
-- SQLite kann den Primärschlüssel nicht via ALTER ändern -> Tabelle neu aufbauen.

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS urlaub_campingplaetze_new (
    id TEXT PRIMARY KEY,
    urlaub_id TEXT NOT NULL,
    campingplatz_id TEXT NOT NULL,
    start_datum TEXT,
    end_datum TEXT,
    notizen TEXT,
    sort_index INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE,
    FOREIGN KEY (campingplatz_id) REFERENCES campingplaetze(id) ON DELETE CASCADE
);

-- Bestehende Zuordnungen übernehmen die Dauer aus dem jeweiligen Urlaub,
-- damit der abgeleitete Reisezeitraum identisch bleibt.
INSERT INTO urlaub_campingplaetze_new
    (id, urlaub_id, campingplatz_id, start_datum, end_datum, notizen, sort_index, created_at)
SELECT
    lower(hex(randomblob(16))),
    uc.urlaub_id,
    uc.campingplatz_id,
    u.startdatum,
    u.enddatum,
    uc.notizen,
    uc.sort_index,
    uc.created_at
FROM urlaub_campingplaetze uc
JOIN urlaube u ON u.id = uc.urlaub_id;

DROP TABLE urlaub_campingplaetze;
ALTER TABLE urlaub_campingplaetze_new RENAME TO urlaub_campingplaetze;

CREATE INDEX IF NOT EXISTS idx_urlaub_campingplaetze_urlaub_id ON urlaub_campingplaetze(urlaub_id);
CREATE INDEX IF NOT EXISTS idx_urlaub_campingplaetze_campingplatz_id ON urlaub_campingplaetze(campingplatz_id);

-- Routen-Cache zwischen zwei Campingplätzen (geografisch, nutzerunabhängig)
CREATE TABLE IF NOT EXISTS campingplatz_segment_routen_cache (
    from_campingplatz_id TEXT NOT NULL,
    to_campingplatz_id TEXT NOT NULL,
    distance_km REAL NOT NULL,
    duration_min REAL NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'haversine')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (from_campingplatz_id, to_campingplatz_id),
    FOREIGN KEY (from_campingplatz_id) REFERENCES campingplaetze(id) ON DELETE CASCADE,
    FOREIGN KEY (to_campingplatz_id) REFERENCES campingplaetze(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campingplatz_segment_routen_cache_from ON campingplatz_segment_routen_cache(from_campingplatz_id);
CREATE INDEX IF NOT EXISTS idx_campingplatz_segment_routen_cache_to ON campingplatz_segment_routen_cache(to_campingplatz_id);

PRAGMA foreign_keys=ON;
