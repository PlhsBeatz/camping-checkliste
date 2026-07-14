-- Migration 0033: GPS-/Reise-Modus-Einstellung pro Benutzer (Profil)
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0033_user_reise_gps_mode.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0033_user_reise_gps_mode.sql

ALTER TABLE users ADD COLUMN reise_gps_mode TEXT NOT NULL DEFAULT 'auto';
