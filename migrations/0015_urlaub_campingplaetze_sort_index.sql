-- Migration 0015: Sortierreihenfolge für Urlaubs-Campingplätze
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0015_urlaub_campingplaetze_sort_index.sql

ALTER TABLE urlaub_campingplaetze ADD COLUMN sort_index INTEGER;

