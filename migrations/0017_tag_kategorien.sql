-- Tag-Kategorien (gruppierte Tags) mit Reihenfolge; bestehende Tags werden "Zeit" zugeordnet
-- Datum: 2026-03-22

CREATE TABLE IF NOT EXISTS tag_kategorien (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  reihenfolge INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tag_kategorien (id, titel, reihenfolge) VALUES
  ('tag-kat-zeit', 'Zeit', 0),
  ('tag-kat-aktivitaeten', 'Aktivitäten', 1),
  ('tag-kat-reiseziel', 'Reiseziel', 2);

ALTER TABLE tags ADD COLUMN tag_kategorie_id TEXT REFERENCES tag_kategorien(id) ON DELETE RESTRICT;
ALTER TABLE tags ADD COLUMN reihenfolge INTEGER;

UPDATE tags SET tag_kategorie_id = 'tag-kat-zeit' WHERE tag_kategorie_id IS NULL;

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tag_kategorie_id ORDER BY titel) - 1 AS rn
  FROM tags
)
UPDATE tags SET reihenfolge = (
  SELECT rn FROM ordered WHERE ordered.id = tags.id
)
WHERE EXISTS (SELECT 1 FROM ordered WHERE ordered.id = tags.id);

CREATE INDEX IF NOT EXISTS idx_tags_tag_kategorie_id ON tags(tag_kategorie_id);
