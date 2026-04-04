-- Campingplatz-Fotos (R2 + Google-Metadaten), mehrere pro Platz, genau ein Cover
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0019_campingplatz_fotos.sql

CREATE TABLE IF NOT EXISTS campingplatz_fotos (
  id TEXT PRIMARY KEY NOT NULL,
  campingplatz_id TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  is_cover INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL CHECK (source IN ('google', 'upload')),
  google_photo_name TEXT,
  r2_object_key TEXT,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  google_attributions_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campingplatz_id) REFERENCES campingplaetze(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campingplatz_fotos_campingplatz_id
  ON campingplatz_fotos(campingplatz_id);

CREATE INDEX IF NOT EXISTS idx_campingplatz_fotos_cover
  ON campingplatz_fotos(campingplatz_id, is_cover);

-- Bestehende Einzel-Fotos (photo_name) als Cover-Zeile übernehmen
INSERT INTO campingplatz_fotos (
  id,
  campingplatz_id,
  sort_index,
  is_cover,
  source,
  google_photo_name,
  r2_object_key,
  content_type
)
SELECT
  lower(hex(randomblob(16))) || lower(hex(randomblob(16))),
  id,
  0,
  1,
  'google',
  photo_name,
  NULL,
  'image/jpeg'
FROM campingplaetze
WHERE photo_name IS NOT NULL AND trim(photo_name) != '';
