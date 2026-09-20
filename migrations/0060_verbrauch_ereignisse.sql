-- Migration 0060: Verbrauch – Auffüll-/Kauf-Ereignisse während einer Messung
-- Lokal:  npx wrangler d1 migrations apply camping-db --local
-- Remote: npx wrangler d1 migrations apply camping-db --remote

CREATE TABLE IF NOT EXISTS verbrauch_ereignisse (
    id TEXT PRIMARY KEY,
    messung_id TEXT NOT NULL,
    typ TEXT NOT NULL DEFAULT 'auffuellung'
        CHECK (typ IN ('auffuellung')),
    datum TEXT,
    menge REAL NOT NULL,
    notizen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (messung_id) REFERENCES verbrauch_messungen(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verbrauch_ereignisse_messung
    ON verbrauch_ereignisse(messung_id, datum, created_at);
