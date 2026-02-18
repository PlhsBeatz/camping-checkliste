-- Migration 0004: Feld "erst am Abreisetag gepackt" für Ausrüstungsgegenstände
-- Gegenstände mit dieser Markierung werden als "erst am Abreisetag zu packen" gekennzeichnet

ALTER TABLE ausruestungsgegenstaende ADD COLUMN erst_abreisetag_gepackt INTEGER NOT NULL DEFAULT 0;
