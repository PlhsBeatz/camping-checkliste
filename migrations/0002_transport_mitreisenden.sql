-- Migration 0002: Transport und Mitreisenden-Verwaltung
-- Dieses Skript erweitert das Schema um Funktionen für Transport-Verwaltung und Mitreisenden-spezifisches Abhaken

-- 1. Füge transport_id zu packlisten_eintraege hinzu
-- Dies ermöglicht es, für jeden Packlisten-Eintrag individuell festzulegen, ob er im Wohnwagen oder Auto transportiert wird
ALTER TABLE packlisten_eintraege ADD COLUMN transport_id TEXT;
CREATE INDEX idx_packlisten_eintraege_transport_id ON packlisten_eintraege(transport_id);

-- 2. Füge mitreisenden_typ zu ausruestungsgegenstaende hinzu
-- Mögliche Werte:
--   'pauschal': Wird einmal für den gesamten Urlaub abgehakt (z.B. Gasflasche)
--   'alle': Jeder Mitreisende muss separat abhaken (z.B. Kleidung, Kosmetik)
--   'ausgewaehlte': Nur bestimmte Personen müssen abhaken (z.B. Kontaktlinsen, Spielzeug)
ALTER TABLE ausruestungsgegenstaende ADD COLUMN mitreisenden_typ TEXT NOT NULL DEFAULT 'pauschal';
ALTER TABLE ausruestungsgegenstaende ADD CONSTRAINT check_mitreisenden_typ 
  CHECK (mitreisenden_typ IN ('pauschal', 'alle', 'ausgewaehlte'));
CREATE INDEX idx_ausruestungsgegenstaende_mitreisenden_typ ON ausruestungsgegenstaende(mitreisenden_typ);

-- 3. Erstelle Tabelle für Standard-Mitreisenden-Zuordnungen bei Ausrüstungsgegenständen
-- Diese Tabelle speichert, welche Mitreisenden standardmäßig bei "ausgewählten" Gegenständen zugeordnet werden sollen
-- Beispiel: Kontaktlinsen werden standardmäßig nur für Erwachsene mit Sehschwäche zugeordnet
CREATE TABLE ausruestungsgegenstaende_standard_mitreisende (
    gegenstand_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (gegenstand_id, mitreisender_id),
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);
CREATE INDEX idx_ausruestungsgegenstaende_standard_mitreisende_gegenstand_id 
  ON ausruestungsgegenstaende_standard_mitreisende(gegenstand_id);
CREATE INDEX idx_ausruestungsgegenstaende_standard_mitreisende_mitreisender_id 
  ON ausruestungsgegenstaende_standard_mitreisende(mitreisender_id);

-- 4. Füge gepackt_status zu packlisten_eintrag_mitreisende hinzu
-- Dies ermöglicht es, für jeden Mitreisenden separat zu tracken, ob er den Gegenstand gepackt hat
ALTER TABLE packlisten_eintrag_mitreisende ADD COLUMN gepackt INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_packlisten_eintrag_mitreisende_gepackt ON packlisten_eintrag_mitreisende(gepackt);

-- 5. Trigger für updated_at auf ausruestungsgegenstaende_standard_mitreisende ist nicht nötig, 
--    da diese Tabelle nur created_at hat
