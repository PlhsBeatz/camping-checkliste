-- Transport pro Mitreisenden für Packlisten-Einträge (z.B. "Luisa nimmt Kissen ins Auto")
-- Ausführen: wrangler d1 execute <DB_NAME> --remote --file=./migrations/0010_mitreisender_transport.sql
ALTER TABLE packlisten_eintrag_mitreisende ADD COLUMN transport_id TEXT;
