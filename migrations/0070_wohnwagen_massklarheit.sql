-- Maßklarheit: Gesamtlänge (mit Deichsel) vs. Aufbaulänge; Deichsel im Grundriss-Bild
ALTER TABLE wohnwagen_katalog ADD COLUMN laenge_gesamt_m REAL;
ALTER TABLE wohnwagen_katalog ADD COLUMN laenge_aufbau_m REAL;
ALTER TABLE wohnwagen_katalog ADD COLUMN deichsel_im_bild INTEGER;
ALTER TABLE wohnwagen_katalog ADD COLUMN mass_hinweis TEXT;

ALTER TABLE transportmittel ADD COLUMN laenge_gesamt_m REAL;
ALTER TABLE transportmittel ADD COLUMN laenge_aufbau_m REAL;
ALTER TABLE transportmittel ADD COLUMN deichsel_im_bild INTEGER;
ALTER TABLE transportmittel ADD COLUMN mass_hinweis TEXT;
