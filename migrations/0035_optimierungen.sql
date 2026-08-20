-- Optimierungen (Tools): Admin-Backlog für Ideen und geplante Anpassungen

CREATE TABLE IF NOT EXISTS optimierungen (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    notiz TEXT,
    bereich TEXT NOT NULL DEFAULT 'ausstattung',
    status TEXT NOT NULL DEFAULT 'idee',
    prioritaet TEXT,
    zeitfenster TEXT,
    zeit_jahr INTEGER,
    zeit_notiz TEXT,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_optimierungen_status ON optimierungen(status);

CREATE TRIGGER IF NOT EXISTS update_optimierungen_timestamp
AFTER UPDATE ON optimierungen
BEGIN
  UPDATE optimierungen SET updated_at = datetime('now') WHERE id = NEW.id;
END;
