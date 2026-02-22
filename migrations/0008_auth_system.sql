-- Migration: Auth-System (users, einladungen, mitreisende_berechtigungen, gepackt_vorgemerkt)
-- Datum: 2026-02-22
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0008_auth_system.sql

-- Table: users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'kind', 'gast')),
    mitreisender_id TEXT UNIQUE,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mitreisender_id ON users(mitreisender_id);

-- Table: einladungen
CREATE TABLE IF NOT EXISTS einladungen (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    mitreisender_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('kind', 'gast')),
    erstellt_von TEXT,
    eingeladen_am TEXT NOT NULL DEFAULT (datetime('now')),
    angenommen_am TEXT,
    ablauf TEXT,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE,
    FOREIGN KEY (erstellt_von) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_einladungen_token ON einladungen(token);
CREATE INDEX IF NOT EXISTS idx_einladungen_mitreisender_id ON einladungen(mitreisender_id);

-- Table: mitreisende_berechtigungen (konfigurierbare Kinder-Rechte)
CREATE TABLE IF NOT EXISTS mitreisende_berechtigungen (
    mitreisender_id TEXT NOT NULL,
    berechtigung TEXT NOT NULL,
    PRIMARY KEY (mitreisender_id, berechtigung),
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);

-- Schema-Erweiterungen für vorgemerkte Einträge (Kinder-Kontrolle)
ALTER TABLE packlisten_eintraege ADD COLUMN gepackt_vorgemerkt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE packlisten_eintraege ADD COLUMN gepackt_vorgemerkt_durch TEXT;

-- packlisten_eintrag_mitreisende hat bereits gepackt; wir fügen gepackt_vorgemerkt hinzu
ALTER TABLE packlisten_eintrag_mitreisende ADD COLUMN gepackt_vorgemerkt INTEGER NOT NULL DEFAULT 0;
