-- Standardansicht pro Urlaub: Packliste oder Alles
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0016_packliste_default_ansicht.sql
ALTER TABLE urlaube ADD COLUMN packliste_default_ansicht TEXT DEFAULT 'packliste';
