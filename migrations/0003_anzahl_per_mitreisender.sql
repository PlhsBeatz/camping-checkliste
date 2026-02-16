-- Anzahl pro Mitreisenden für Einträge mit mitreisenden_typ 'alle' oder 'ausgewaehlte'
-- NULL = Eltern-Eintrag anzahl verwenden
-- Ausführen: wrangler d1 execute <DB_NAME> --remote --file=./migrations/0003_anzahl_per_mitreisender.sql
ALTER TABLE packlisten_eintrag_mitreisende ADD COLUMN anzahl INTEGER;
