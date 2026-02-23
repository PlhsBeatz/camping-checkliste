-- Migration 0012: Temporäre Packlisteneinträge (ohne Ausrüstungsgegenstand)
-- Einträge nur für diese Packliste (z. B. einmalige Lebensmittel), nicht in der Ausrüstung.

CREATE TABLE IF NOT EXISTS packlisten_eintraege_temporaer (
    id TEXT PRIMARY KEY,
    packliste_id TEXT NOT NULL,
    was TEXT NOT NULL,
    kategorie_id TEXT NOT NULL,
    anzahl INTEGER NOT NULL DEFAULT 1,
    gepackt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt_durch TEXT,
    bemerkung TEXT,
    transport_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (packliste_id) REFERENCES packlisten(id) ON DELETE CASCADE,
    FOREIGN KEY (kategorie_id) REFERENCES kategorien(id),
    CHECK (anzahl >= 0)
);
CREATE INDEX IF NOT EXISTS idx_packlisten_eintraege_temporaer_packliste_id ON packlisten_eintraege_temporaer(packliste_id);

-- Mitreisende für temporäre Einträge (optional, gleiche Struktur wie bei normalen Einträgen)
CREATE TABLE IF NOT EXISTS packlisten_eintrag_mitreisende_temporaer (
    packlisten_eintrag_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    gepackt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt INTEGER NOT NULL DEFAULT 0,
    anzahl INTEGER,
    transport_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (packlisten_eintrag_id, mitreisender_id),
    FOREIGN KEY (packlisten_eintrag_id) REFERENCES packlisten_eintraege_temporaer(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pem_temporaer_eintrag ON packlisten_eintrag_mitreisende_temporaer(packlisten_eintrag_id);
CREATE INDEX IF NOT EXISTS idx_pem_temporaer_mitreisender ON packlisten_eintrag_mitreisende_temporaer(mitreisender_id);
