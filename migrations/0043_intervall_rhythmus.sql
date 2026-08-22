-- Migration 0043: Intervall-Rhythmus (taggenau vs. Monatsende)
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0043_intervall_rhythmus.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0043_intervall_rhythmus.sql

ALTER TABLE faelligkeiten ADD COLUMN intervall_rhythmus TEXT NOT NULL DEFAULT 'taggenau'
  CHECK (intervall_rhythmus IN ('taggenau', 'monatsende'));
