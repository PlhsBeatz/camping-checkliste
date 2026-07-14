-- Migration 0032: Push-Benachrichtigungs-Einstellungen pro Benutzer (Profil)
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0032_user_push_preferences.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0032_user_push_preferences.sql

ALTER TABLE users ADD COLUMN push_notifications_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN push_rastplatz_nearby INTEGER NOT NULL DEFAULT 1;
