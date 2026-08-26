-- Migration: Buchungsfelder pro Campingplatz-Aufenthalt (urlaub_campingplaetze)
-- Folgt auf 0048_heute_hub.sql

ALTER TABLE urlaub_campingplaetze ADD COLUMN platznummer TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN buchungsnummer TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN buchungsstatus TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN checkin_zeit TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN checkout_zeit TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN zugangscode TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN unterkunftstyp TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN preis_gesamt REAL;
ALTER TABLE urlaub_campingplaetze ADD COLUMN waehrung TEXT DEFAULT 'EUR';
ALTER TABLE urlaub_campingplaetze ADD COLUMN anzahlung_betrag REAL;
ALTER TABLE urlaub_campingplaetze ADD COLUMN restzahlung_faellig_am TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN buchungsdatum TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN stornierungsfrist TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN extras_json TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN kontakt_platz TEXT;
ALTER TABLE urlaub_campingplaetze ADD COLUMN notizen_buchung TEXT;
