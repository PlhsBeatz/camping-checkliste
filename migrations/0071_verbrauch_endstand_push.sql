-- Migration 0071: Push-Erinnerung Verbrauchs-Endstände nach Heimkehr
-- Lokal:  npx wrangler d1 migrations apply camping-db --local
-- Remote: npx wrangler d1 migrations apply camping-db --remote

ALTER TABLE users ADD COLUMN push_verbrauch_endstand INTEGER NOT NULL DEFAULT 1;
ALTER TABLE urlaube ADD COLUMN push_verbrauch_endstand_sent INTEGER NOT NULL DEFAULT 0;
