-- Migration 0047: Separates Flag für Fälligkeits-Webhook (unabhängig von Erinnerungs-Push)
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0047_push_due_sent.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0047_push_due_sent.sql

ALTER TABLE faelligkeiten ADD COLUMN push_due_sent INTEGER NOT NULL DEFAULT 0;
