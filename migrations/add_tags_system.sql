-- Migration: Tag-System für Ausrüstungsgegenstände
-- Datum: 2026-02-04
-- Beschreibung: Fügt Tags-Tabellen und Standard-Flag für automatische Packlisten-Generierung hinzu

-- Tabelle für Tags
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  farbe TEXT,
  icon TEXT,
  beschreibung TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tabelle für Zuordnung: Ausrüstungsgegenstand <-> Tags (n:m)
CREATE TABLE IF NOT EXISTS ausruestungsgegenstaende_tags (
  gegenstand_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (gegenstand_id, tag_id),
  FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Standard-Flag zur Ausrüstungstabelle hinzufügen
ALTER TABLE ausruestungsgegenstaende 
ADD COLUMN is_standard INTEGER DEFAULT 0;

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_tags_titel ON tags(titel);
CREATE INDEX IF NOT EXISTS idx_ausruestungsgegenstaende_tags_gegenstand ON ausruestungsgegenstaende_tags(gegenstand_id);
CREATE INDEX IF NOT EXISTS idx_ausruestungsgegenstaende_tags_tag ON ausruestungsgegenstaende_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_ausruestungsgegenstaende_is_standard ON ausruestungsgegenstaende(is_standard);

-- Beispiel-Tags einfügen (optional)
INSERT OR IGNORE INTO tags (id, titel, farbe, icon, beschreibung) VALUES
  ('tag-sommer', 'Sommer', '#f59e0b', '☀️', 'Für warme Jahreszeiten'),
  ('tag-winter', 'Winter', '#3b82f6', '❄️', 'Für kalte Jahreszeiten'),
  ('tag-strand', 'Strand', '#06b6d4', '🏖️', 'Für Strandurlaube'),
  ('tag-berge', 'Berge', '#10b981', '⛰️', 'Für Bergtouren'),
  ('tag-feuer', 'Feuerküche', '#ef4444', '🔥', 'Kochen am Lagerfeuer'),
  ('tag-wasser', 'Wassersport', '#0ea5e9', '🌊', 'Wassersportaktivitäten');
