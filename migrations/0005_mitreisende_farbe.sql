-- Migration: Farbe für Mitreisende
-- Datum: 2026-02-18
-- Beschreibung: Fügt farbe-Spalte für Mitreisende hinzu (Hex-Farbcode, z.B. #3b82f6)

ALTER TABLE mitreisende ADD COLUMN farbe TEXT;
