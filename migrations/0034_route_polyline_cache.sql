-- Polyline für Rastplatz-Suche entlang der echten Route (Google Directions)
ALTER TABLE campingplatz_routen_cache ADD COLUMN encoded_polyline TEXT;
ALTER TABLE campingplatz_routen_cache ADD COLUMN return_encoded_polyline TEXT;
ALTER TABLE campingplatz_segment_routen_cache ADD COLUMN encoded_polyline TEXT;
