-- Migration 0042: Push-Präferenz für Wartungs-Fälligkeiten
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0042_push_wartung_faellig.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0042_push_wartung_faellig.sql

ALTER TABLE users ADD COLUMN push_wartung_faellig INTEGER NOT NULL DEFAULT 1;
