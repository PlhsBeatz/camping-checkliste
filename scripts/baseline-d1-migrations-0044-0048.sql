-- Einmalig, wenn 0044–0048 bereits manuell (--file) angewendet wurden,
-- wrangler d1 migrations apply aber bei 0044 mit "duplicate column" abbricht.
--
-- Lokal:
--   npx wrangler d1 execute camping-db --local --file=scripts/baseline-d1-migrations-0044-0048.sql
-- Remote (nur wenn dort gleicher Stand):
--   npx wrangler d1 execute camping-db --remote --file=scripts/baseline-d1-migrations-0044-0048.sql
--
-- Danach fehlende Migrationen anwenden:
--   npx wrangler d1 migrations apply camping-db --local
--   npx wrangler d1 migrations apply camping-db --remote

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0044_initial_erledigung_am.sql'),
  ('0045_faelligkeit_typ_intervall.sql'),
  ('0046_faelligkeit_vorlagen.sql'),
  ('0047_push_due_sent.sql'),
  ('0048_heute_hub.sql');
