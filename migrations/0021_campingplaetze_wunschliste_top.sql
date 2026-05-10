-- Wunschliste & Top-Favorit für aktive Campingplätze (Archiv bleibt für nicht mehr existente Plätze)
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0021_campingplaetze_wunschliste_top.sql

ALTER TABLE campingplaetze ADD COLUMN aufwunschliste INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campingplaetze ADD COLUMN top_favorit INTEGER NOT NULL DEFAULT 0;
