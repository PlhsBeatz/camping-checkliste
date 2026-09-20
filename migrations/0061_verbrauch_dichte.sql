-- Migration 0061: Verbrauch-Medien – Dichte & Leergewicht für Liter-aus-Gewicht
-- Lokal:  npx wrangler d1 migrations apply camping-db --local
-- Remote: npx wrangler d1 migrations apply camping-db --remote

ALTER TABLE verbrauch_medien ADD COLUMN dichte_kg_pro_l REAL;
ALTER TABLE verbrauch_medien ADD COLUMN leergewicht_kg REAL;

-- Petroleum: typische Dichte ~0,80 kg/l
UPDATE verbrauch_medien
SET dichte_kg_pro_l = 0.80
WHERE schluessel = 'petroleum' AND dichte_kg_pro_l IS NULL;

-- Diesel / AdBlue (falls aktiv): sinnvolle Defaults
UPDATE verbrauch_medien
SET dichte_kg_pro_l = 0.84
WHERE schluessel = 'diesel' AND dichte_kg_pro_l IS NULL;

UPDATE verbrauch_medien
SET dichte_kg_pro_l = 1.09
WHERE schluessel = 'adblue' AND dichte_kg_pro_l IS NULL;
