-- Migration: Einladungen auch für Admin-Rolle
-- Datum: 2026-02-22
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0009_einladungen_admin.sql

-- SQLite: CHECK-Constraint nicht änderbar, Tabelle neu erstellen
CREATE TABLE IF NOT EXISTS einladungen_new (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    mitreisender_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'kind', 'gast')),
    erstellt_von TEXT,
    eingeladen_am TEXT NOT NULL DEFAULT (datetime('now')),
    angenommen_am TEXT,
    ablauf TEXT,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE,
    FOREIGN KEY (erstellt_von) REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO einladungen_new SELECT id, token, mitreisender_id, role, erstellt_von, eingeladen_am, angenommen_am, ablauf FROM einladungen;
DROP TABLE einladungen;
ALTER TABLE einladungen_new RENAME TO einladungen;
CREATE INDEX IF NOT EXISTS idx_einladungen_token ON einladungen(token);
CREATE INDEX IF NOT EXISTS idx_einladungen_mitreisender_id ON einladungen(mitreisender_id);
