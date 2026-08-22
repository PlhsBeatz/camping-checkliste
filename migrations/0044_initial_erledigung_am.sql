-- Migration 0044: Erste Erledigung beim Anlegen einfrieren (unabhängig von Quittierungen)
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0044_initial_erledigung_am.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0044_initial_erledigung_am.sql

ALTER TABLE faelligkeiten ADD COLUMN initial_erledigung_am TEXT;

-- Best effort: nur wo noch keine Quittierung/Erledigung in der Historie existiert
UPDATE faelligkeiten
SET initial_erledigung_am = letzte_erledigung_am
WHERE letzte_erledigung_am IS NOT NULL
  AND id NOT IN (
    SELECT faelligkeit_id FROM faelligkeiten_historie
    WHERE ereignis_typ IN ('quittiert', 'erledigt')
  );
