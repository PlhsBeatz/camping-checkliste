-- Migration 0066: Transportmittel als Urlaubs-Standard markieren
-- Lokal: npx wrangler d1 migrations apply camping-db --local

ALTER TABLE transportmittel ADD COLUMN urlaub_standard INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_transportmittel_urlaub_standard ON transportmittel(urlaub_standard);
