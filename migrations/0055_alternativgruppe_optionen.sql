-- Migration 0055: Entweder-oder mit Seiten (1 gegen mehrere, z. B. Sessel oder Sofa+Hocker)
-- Anwenden: npx wrangler d1 migrations apply camping-db --local
-- Produktion: npx wrangler d1 migrations apply camping-db --remote

ALTER TABLE ausruestung_alternativgruppe_items ADD COLUMN option_index INTEGER NOT NULL DEFAULT 0;

-- Bestehende Gruppen: jeder Gegenstand eine eigene Seite (Paar bleibt 1 gegen 1)
UPDATE ausruestung_alternativgruppe_items
SET option_index = (
  SELECT COUNT(*)
  FROM ausruestung_alternativgruppe_items AS i2
  WHERE i2.gruppe_id = ausruestung_alternativgruppe_items.gruppe_id
    AND i2.gegenstand_id < ausruestung_alternativgruppe_items.gegenstand_id
);
