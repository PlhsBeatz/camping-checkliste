-- Migration 0057: Entweder-oder-Hinweis pro Packliste ignorieren
-- Anwenden: npx wrangler d1 migrations apply camping-db --local
-- Produktion: npx wrangler d1 migrations apply camping-db --remote

CREATE TABLE IF NOT EXISTS packliste_xor_ignoriert (
    packliste_id TEXT NOT NULL,
    gruppe_id TEXT NOT NULL,
    ignoriert_am TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (packliste_id, gruppe_id),
    FOREIGN KEY (packliste_id) REFERENCES packlisten(id) ON DELETE CASCADE,
    FOREIGN KEY (gruppe_id) REFERENCES ausruestung_alternativgruppen(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_packliste_xor_ignoriert_gruppe
    ON packliste_xor_ignoriert(gruppe_id);
