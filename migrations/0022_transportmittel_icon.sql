-- Icon-Schlüssel für Transportmittel (Packliste: kompakte Anzeige)
-- Einmalig ausführen. Bei "duplicate column name: icon" ist die Spalte bereits vorhanden –
-- dann nur migrations/0023_transportmittel_icon_data.sql ausführen.
ALTER TABLE transportmittel ADD COLUMN icon TEXT;
