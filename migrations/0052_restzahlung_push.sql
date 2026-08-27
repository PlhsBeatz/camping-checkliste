-- Migration 0052: Push-Erinnerung für Restzahlung (30 Tage vorher)
-- Local:  wrangler d1 execute camping-db --local --file=./migrations/0052_restzahlung_push.sql
-- Remote: wrangler d1 execute camping-db --remote --file=./migrations/0052_restzahlung_push.sql

ALTER TABLE urlaub_campingplaetze ADD COLUMN push_restzahlung_30d_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN push_restzahlung INTEGER NOT NULL DEFAULT 1;
