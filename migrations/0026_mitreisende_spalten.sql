-- Schritt 1/3: Spalten an mitreisende (nur einmal ausführen)
-- Fehler "duplicate column name: gruppe_id" → Spalten existieren bereits, diesen Schritt überspringen.

ALTER TABLE mitreisende ADD COLUMN gruppe_id TEXT REFERENCES mitreisenden_gruppe(id);
ALTER TABLE mitreisende ADD COLUMN personentyp TEXT NOT NULL DEFAULT 'erwachsen';
