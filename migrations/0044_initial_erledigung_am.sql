-- Migration 0044: Erste Erledigung beim Anlegen einfrieren (unabhängig von Quittierungen)
-- Ausführen: wrangler d1 migrations apply camping-db --local
-- Bei Fehler "duplicate column name: initial_erledigung_am" → Spalte existiert bereits;
-- dann scripts/baseline-d1-migrations-0044-0048.sql ausführen und migrations apply erneut.

ALTER TABLE faelligkeiten ADD COLUMN initial_erledigung_am TEXT;

-- Best effort: nur wo noch keine Quittierung/Erledigung in der Historie existiert
UPDATE faelligkeiten
SET initial_erledigung_am = letzte_erledigung_am
WHERE letzte_erledigung_am IS NOT NULL
  AND id NOT IN (
    SELECT faelligkeit_id FROM faelligkeiten_historie
    WHERE ereignis_typ IN ('quittiert', 'erledigt')
  );
