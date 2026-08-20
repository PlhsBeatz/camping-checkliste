-- Optimierungen: Links und Fotos (R2 wie Campingplatz-Fotos)

CREATE TABLE IF NOT EXISTS optimierungen_links (
    id TEXT PRIMARY KEY,
    optimierung_id TEXT NOT NULL,
    url TEXT NOT NULL,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (optimierung_id) REFERENCES optimierungen(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_optimierungen_links_optimierung_id
  ON optimierungen_links(optimierung_id);

CREATE TABLE IF NOT EXISTS optimierungen_fotos (
    id TEXT PRIMARY KEY,
    optimierung_id TEXT NOT NULL,
    sort_index INTEGER NOT NULL DEFAULT 0,
    r2_object_key TEXT,
    content_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (optimierung_id) REFERENCES optimierungen(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_optimierungen_fotos_optimierung_id
  ON optimierungen_fotos(optimierung_id);
