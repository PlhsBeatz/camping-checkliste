-- Netz-Refresh für Wohnwagen-Katalog inkl. Grundriss-Bild (R2)
ALTER TABLE wohnwagen_katalog ADD COLUMN source_url TEXT;
ALTER TABLE wohnwagen_katalog ADD COLUMN grundriss_bild_url TEXT;
ALTER TABLE wohnwagen_katalog ADD COLUMN r2_object_key TEXT;
ALTER TABLE wohnwagen_katalog ADD COLUMN content_type TEXT;
ALTER TABLE wohnwagen_katalog ADD COLUMN refreshed_at TEXT;
ALTER TABLE wohnwagen_katalog ADD COLUMN notes TEXT;

-- Grundriss-Bild am Transportmittel (Kopie/Verweis auf R2)
ALTER TABLE transportmittel ADD COLUMN grundriss_bild_r2_key TEXT;
ALTER TABLE transportmittel ADD COLUMN grundriss_bild_content_type TEXT;
