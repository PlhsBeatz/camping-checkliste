-- Migration: Platzplan-URLs am Campingplatz-Stammdatensatz
-- Folgt auf 0050_booking_import.sql

ALTER TABLE campingplaetze ADD COLUMN platzplan_url TEXT;
ALTER TABLE campingplaetze ADD COLUMN platzplan_url_vorlage TEXT;
ALTER TABLE campingplaetze ADD COLUMN platzplan_hinweis TEXT;
