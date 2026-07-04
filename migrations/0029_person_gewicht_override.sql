-- Migration 0029: Pro-Person-Gewicht für personengebundene Packlisteneinträge

ALTER TABLE packlisten_eintrag_mitreisende ADD COLUMN einzelgewicht_override REAL;
ALTER TABLE packlisten_eintrag_mitreisende_temporaer ADD COLUMN einzelgewicht_override REAL;
