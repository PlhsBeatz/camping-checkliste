-- Dynamische Mengenregeln für Ausrüstungsgegenstände
-- Speichert als JSON eine Regel, aus der beim Generieren der Packliste
-- abhängig von Reisedauer und Mitreisenden-Typ die Anzahl berechnet wird.
-- NULL bedeutet: keine Regel → Fallback auf standard_anzahl (abwärtskompatibel).
-- Ausführen: wrangler d1 execute camping-db --remote --file=./migrations/0020_mengenregel.sql
ALTER TABLE ausruestungsgegenstaende ADD COLUMN mengenregel TEXT;
