-- Migration 0047: Separates Flag für Fälligkeits-Webhook (unabhängig von Erinnerungs-Push)
-- Bei Fehler "duplicate column name: push_due_sent" → scripts/baseline-d1-migrations-0044-0048.sql

ALTER TABLE faelligkeiten ADD COLUMN push_due_sent INTEGER NOT NULL DEFAULT 0;
