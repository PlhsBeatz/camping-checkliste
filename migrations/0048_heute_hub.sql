-- Migration 0048: Heute-Hub — Checklisten-Anlass + Attention-Snooze
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0048_heute_hub.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0048_heute_hub.sql

ALTER TABLE checklisten ADD COLUMN hub_anlass TEXT NOT NULL DEFAULT 'keine';

UPDATE checklisten SET hub_anlass = 'abfahrt' WHERE id = 'chk_abfahrt';
UPDATE checklisten SET hub_anlass = 'einwintern' WHERE id = 'chk_einwintern';

CREATE TABLE IF NOT EXISTS attention_snooze (
    item_key TEXT PRIMARY KEY,
    snoozed_until TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
