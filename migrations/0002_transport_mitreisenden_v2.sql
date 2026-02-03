-- Migration 0002: Transport und Mitreisenden-Verwaltung (Version 2 - korrigiert für D1)
-- Dieses Skript erweitert das Schema um Funktionen für Transport-Verwaltung und Mitreisenden-spezifisches Abhaken

-- 1. Füge transport_id zu packlisten_eintraege hinzu
-- Dies ermöglicht es, für jeden Packlisten-Eintrag individuell festzulegen, ob er im Wohnwagen oder Auto transportiert wird
ALTER TABLE packlisten_eintraege ADD COLUMN transport_id TEXT;

-- 2. Füge mitreisenden_typ zu ausruestungsgegenstaende hinzu
-- Mögliche Werte:
--   'pauschal': Wird einmal für den gesamten Urlaub abgehakt (z.B. Gasflasche)
--   'alle': Jeder Mitreisende muss separat abhaken (z.B. Kleidung, Kosmetik)
--   'ausgewaehlte': Nur bestimmte Personen müssen abhaken (z.B. Kontaktlinsen, Spielzeug)
-- HINWEIS: CHECK Constraint wird direkt in der Spalten-Definition angegeben, da D1 kein ALTER TABLE ADD CONSTRAINT unterstützt
ALTER TABLE ausruestungsgegenstaende ADD COLUMN mitreisenden_typ TEXT NOT NULL DEFAULT 'pauschal' CHECK (mitreisenden_typ IN ('pauschal', 'alle', 'ausgewaehlte'));

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

-- 4. Füge gepackt_status zu packlisten_eintrag_mitreisende hinzu
-- Dies ermöglicht es, für jeden Mitreisenden separat zu tracken, ob er den Gegenstand gepackt hat
ALTER TABLE packlisten_eintrag_mitreisende ADD COLUMN gepackt INTEGER NOT NULL DEFAULT 0;

-- 5. Erstelle Indizes für bessere Performance
CREATE INDEX idx_packlisten_eintraege_transport_id ON packlisten_eintraege(transport_id);
CREATE INDEX idx_ausruestungsgegenstaende_mitreisenden_typ ON ausruestungsgegenstaende(mitreisenden_typ);
CREATE INDEX idx_ausruestungsgegenstaende_standard_mitreisende_gegenstand_id ON ausruestungsgegenstaende_standard_mitreisende(gegenstand_id);
CREATE INDEX idx_ausruestungsgegenstaende_standard_mitreisende_mitreisender_id ON ausruestungsgegenstaende_standard_mitreisende(mitreisender_id);
CREATE INDEX idx_packlisten_eintrag_mitreisende_gepackt ON packlisten_eintrag_mitreisende(gepackt);
