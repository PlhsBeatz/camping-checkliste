-- Migration: must_change_password für erzwungene Passwortänderung nach Admin-Reset
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0011_must_change_password.sql

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
