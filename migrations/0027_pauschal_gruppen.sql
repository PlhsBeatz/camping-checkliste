-- Migration 0027: Gruppen-Zuordnung für pauschale Packlisteneinträge

ALTER TABLE packlisten_eintraege ADD COLUMN pauschal_gruppen_modus TEXT DEFAULT 'einmal';
ALTER TABLE packlisten_eintraege ADD COLUMN verantwortliche_gruppe_id TEXT;

ALTER TABLE packlisten_eintraege_temporaer ADD COLUMN pauschal_gruppen_modus TEXT DEFAULT 'einmal';
ALTER TABLE packlisten_eintraege_temporaer ADD COLUMN verantwortliche_gruppe_id TEXT;

CREATE TABLE IF NOT EXISTS packlisten_eintrag_gruppen (
    id TEXT PRIMARY KEY,
    packlisten_eintrag_id TEXT NOT NULL,
    gruppe_id TEXT NOT NULL,
    gepackt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt_durch TEXT,
    anzahl INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (packlisten_eintrag_id) REFERENCES packlisten_eintraege(id) ON DELETE CASCADE,
    FOREIGN KEY (gruppe_id) REFERENCES mitreisenden_gruppe(id) ON DELETE CASCADE,
    UNIQUE(packlisten_eintrag_id, gruppe_id),
    CHECK (anzahl >= 0)
);
CREATE INDEX IF NOT EXISTS idx_peg_eintrag ON packlisten_eintrag_gruppen(packlisten_eintrag_id);
CREATE INDEX IF NOT EXISTS idx_peg_gruppe ON packlisten_eintrag_gruppen(gruppe_id);

CREATE TABLE IF NOT EXISTS packlisten_eintrag_gruppen_temporaer (
    id TEXT PRIMARY KEY,
    packlisten_eintrag_id TEXT NOT NULL,
    gruppe_id TEXT NOT NULL,
    gepackt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt INTEGER NOT NULL DEFAULT 0,
    gepackt_vorgemerkt_durch TEXT,
    anzahl INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (packlisten_eintrag_id) REFERENCES packlisten_eintraege_temporaer(id) ON DELETE CASCADE,
    FOREIGN KEY (gruppe_id) REFERENCES mitreisenden_gruppe(id) ON DELETE CASCADE,
    UNIQUE(packlisten_eintrag_id, gruppe_id),
    CHECK (anzahl >= 0)
);
CREATE INDEX IF NOT EXISTS idx_pegt_eintrag ON packlisten_eintrag_gruppen_temporaer(packlisten_eintrag_id);
CREATE INDEX IF NOT EXISTS idx_pegt_gruppe ON packlisten_eintrag_gruppen_temporaer(gruppe_id);
