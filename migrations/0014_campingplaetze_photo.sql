-- Migration 0014: Campingplätze – Google-Maps-Foto (photo_name)
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0014_campingplaetze_photo.sql

ALTER TABLE campingplaetze ADD COLUMN photo_name TEXT;
