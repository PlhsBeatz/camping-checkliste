-- Stellplatz-Pin und Wohnwagen-Ausrichtung pro Stay (Sonnenausrichtung Planung/Vor Ort)
ALTER TABLE urlaub_campingplaetze ADD COLUMN stellplatz_lat REAL;
ALTER TABLE urlaub_campingplaetze ADD COLUMN stellplatz_lng REAL;
ALTER TABLE urlaub_campingplaetze ADD COLUMN wohnwagen_heading_deg REAL;
