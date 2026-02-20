-- Migration: Pauschalgewicht für Hauptkategorien und Kategorien
-- Datum: 2026-02-20
-- Beschreibung: Pauschale Gewichte auf Hauptkategorie- oder Kategorie-Ebene,
--              Markierung "in Pauschale inbegriffen" pro Ausrüstungsgegenstand

-- 1. Hauptkategorien: Pauschalgewicht, pro Person, Transport
ALTER TABLE hauptkategorien ADD COLUMN pauschalgewicht REAL;
ALTER TABLE hauptkategorien ADD COLUMN pauschal_pro_person INTEGER DEFAULT 0;
ALTER TABLE hauptkategorien ADD COLUMN pauschal_transport_id TEXT REFERENCES transportmittel(id) ON DELETE SET NULL;

-- 2. Kategorien: pro Person, Transport (pauschalgewicht existiert bereits)
ALTER TABLE kategorien ADD COLUMN pauschal_pro_person INTEGER DEFAULT 0;
ALTER TABLE kategorien ADD COLUMN pauschal_transport_id TEXT REFERENCES transportmittel(id) ON DELETE SET NULL;

-- 3. Ausrüstungsgegenstände: in Pauschale inbegriffen
ALTER TABLE ausruestungsgegenstaende ADD COLUMN in_pauschale_inbegriffen INTEGER DEFAULT 0;
