-- Optionaler Grundriss / Maße für Wohnwagen-Platzierung (Sonnenausrichtung)
ALTER TABLE transportmittel ADD COLUMN baujahr INTEGER;
ALTER TABLE transportmittel ADD COLUMN laenge_m REAL;
ALTER TABLE transportmittel ADD COLUMN breite_m REAL;
ALTER TABLE transportmittel ADD COLUMN grundriss_json TEXT;

-- Best-effort Katalog (Hersteller/Modell[/Baujahr] → Maße)
CREATE TABLE IF NOT EXISTS wohnwagen_katalog (
  id TEXT PRIMARY KEY,
  hersteller TEXT NOT NULL,
  modell TEXT NOT NULL,
  baujahr_von INTEGER,
  baujahr_bis INTEGER,
  laenge_m REAL NOT NULL,
  breite_m REAL NOT NULL,
  grundriss_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wohnwagen_katalog_lookup
  ON wohnwagen_katalog (hersteller, modell);

INSERT OR IGNORE INTO wohnwagen_katalog (id, hersteller, modell, baujahr_von, baujahr_bis, laenge_m, breite_m) VALUES
  ('wwk-hobby-deluxe-460lu', 'Hobby', 'De Luxe 460 LU', 2018, 2024, 6.47, 2.30),
  ('wwk-hobby-excellent-540ul', 'Hobby', 'Excellent 540 UL', 2019, 2025, 7.55, 2.50),
  ('wwk-knaus-sport-500eu', 'Knaus', 'Sport 500 EU', 2018, 2024, 7.28, 2.32),
  ('wwk-knaus-suedwind-500uf', 'Knaus', 'Südwind 500 UF', 2020, 2025, 7.45, 2.50),
  ('wwk-fendt-bianco-515sge', 'Fendt', 'Bianco Activ 515 SGE', 2019, 2025, 7.48, 2.50),
  ('wwk-dethleffs-cgo-495qsk', 'Dethleffs', 'c''go 495 QSK', 2019, 2024, 6.98, 2.32),
  ('wwk-tabbert-vivaldi-560td', 'Tabbert', 'Vivaldi 560 TD', 2018, 2023, 7.91, 2.50),
  ('wwk-adria-adora-573pt', 'Adria', 'Adora 573 PT', 2020, 2025, 7.96, 2.48),
  ('wwk-burstner-premio-490ts', 'Bürstner', 'Premio 490 TS', 2019, 2024, 7.06, 2.30),
  ('wwk-weinsberg-caraone-480eu', 'Weinsberg', 'CaraOne 480 EU', 2020, 2025, 6.79, 2.20);
