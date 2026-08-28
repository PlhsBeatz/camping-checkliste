-- Migration 0054: Smarte Vorschläge, Pack-Muster, Alternativgruppen, Campingplatz-Google-Felder
-- Anwenden: npx wrangler d1 migrations apply camping-db --local
-- Produktion: npx wrangler d1 migrations apply camping-db --remote

CREATE TABLE IF NOT EXISTS smart_vorschlaege (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    titel TEXT NOT NULL,
    begruendung TEXT,
    payload_json TEXT NOT NULL DEFAULT '{}',
    kontext_typ TEXT,
    kontext_id TEXT,
    quelle TEXT NOT NULL DEFAULT 'regel',
    fingerprint TEXT NOT NULL,
    snoozed_until TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_smart_vorschlaege_fingerprint
    ON smart_vorschlaege(kind, fingerprint);
CREATE INDEX IF NOT EXISTS idx_smart_vorschlaege_status ON smart_vorschlaege(status);
CREATE INDEX IF NOT EXISTS idx_smart_vorschlaege_kontext
    ON smart_vorschlaege(kontext_typ, kontext_id);

CREATE TABLE IF NOT EXISTS packing_pattern_snapshot (
    id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ausruestung_alternativgruppen (
    id TEXT PRIMARY KEY,
    titel TEXT,
    genau_eines INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ausruestung_alternativgruppe_items (
    gruppe_id TEXT NOT NULL,
    gegenstand_id TEXT NOT NULL,
    PRIMARY KEY (gruppe_id, gegenstand_id),
    FOREIGN KEY (gruppe_id) REFERENCES ausruestung_alternativgruppen(id) ON DELETE CASCADE,
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_altgruppe_items_gegenstand
    ON ausruestung_alternativgruppe_items(gegenstand_id);

CREATE TABLE IF NOT EXISTS ai_call_cache (
    cache_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE campingplaetze ADD COLUMN google_place_id TEXT;
ALTER TABLE campingplaetze ADD COLUMN telefon TEXT;
ALTER TABLE campingplaetze ADD COLUMN oeffnungszeiten TEXT;
