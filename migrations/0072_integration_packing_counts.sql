-- Denormalisierte Packfortschritts-Zähler für günstige Toggle-Updates (D1 rows_read).
ALTER TABLE integration_vacation_state ADD COLUMN packed INTEGER;
ALTER TABLE integration_vacation_state ADD COLUMN total INTEGER;
