-- Migration 0028: Urlaubsspezifisches Gewicht für Packlisteneinträge
-- einzelgewicht_override auf normalen Einträgen (Override der Ausrüstung)
-- einzelgewicht auf temporären Einträgen (kein Ausrüstungs-Stammdatensatz)

ALTER TABLE packlisten_eintraege ADD COLUMN einzelgewicht_override REAL;
ALTER TABLE packlisten_eintraege_temporaer ADD COLUMN einzelgewicht REAL;
