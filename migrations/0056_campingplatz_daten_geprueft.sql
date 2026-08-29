-- Migration 0056: Zeitpunkt der letzten Datenprüfung (Google/Website) je Campingplatz
-- Anwenden: npx wrangler d1 migrations apply camping-db --local
-- Produktion: npx wrangler d1 migrations apply camping-db --remote

ALTER TABLE campingplaetze ADD COLUMN daten_geprueft_am TEXT;
