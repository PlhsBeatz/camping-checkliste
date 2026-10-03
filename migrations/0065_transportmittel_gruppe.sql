-- Migration 0065: Transportmittel einem Haushalt (mitreisenden_gruppe) zuordnen
-- Lokal: npx wrangler d1 migrations apply camping-db --local

ALTER TABLE transportmittel ADD COLUMN gruppe_id TEXT REFERENCES mitreisenden_gruppe(id) ON DELETE SET NULL;

-- Bestandsfahrzeuge → Standard-Haushalt (urlaub_standard_mitnehmen), Fallback erste Gruppe
UPDATE transportmittel
SET gruppe_id = (
  SELECT id FROM mitreisenden_gruppe
  WHERE urlaub_standard_mitnehmen = 1
  ORDER BY sort_order ASC, name ASC
  LIMIT 1
)
WHERE gruppe_id IS NULL;

UPDATE transportmittel
SET gruppe_id = (
  SELECT id FROM mitreisenden_gruppe
  ORDER BY sort_order ASC, name ASC
  LIMIT 1
)
WHERE gruppe_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_transportmittel_gruppe ON transportmittel(gruppe_id);
