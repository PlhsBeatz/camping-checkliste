-- Migration 0064: Transportmittel Urlaubsauswahl, Zeiträume, Personengewichte, Anbauten
-- Lokal: npx wrangler d1 migrations apply camping-db --local
--
-- WICHTIG: Kein DROP/RECREATE von transportmittel!
-- D1 wendet trotz PRAGMA foreign_keys=OFF die ON DELETE-Aktionen an:
--   ausruestungsgegenstaende.transport_id  → SET NULL
--   packlisten_*.transport_id              → SET NULL
--   faelligkeiten / verbrauch              → SET NULL
--   transportmittel_festgewicht_manuell    → CASCADE (Löschung)
-- Name bleibt UNIQUE; Fahrzeugtausch benennt das alte Fahrzeug in der App um.

-- 1) Neue Spalten an transportmittel (fahrzeugtyp mit Default für Bestandszeilen)
ALTER TABLE transportmittel ADD COLUMN fahrzeugtyp TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE transportmittel ADD COLUMN hersteller TEXT;
ALTER TABLE transportmittel ADD COLUMN modell TEXT;
ALTER TABLE transportmittel ADD COLUMN max_stuetzlast REAL;
ALTER TABLE transportmittel ADD COLUMN max_traglast REAL;
ALTER TABLE transportmittel ADD COLUMN aktiv_von TEXT;
ALTER TABLE transportmittel ADD COLUMN aktiv_bis TEXT;
ALTER TABLE transportmittel ADD COLUMN ersetzt_durch_id TEXT REFERENCES transportmittel(id) ON DELETE SET NULL;
ALTER TABLE transportmittel ADD COLUMN traeger_transport_id TEXT REFERENCES transportmittel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transportmittel_traeger ON transportmittel(traeger_transport_id);
CREATE INDEX IF NOT EXISTS idx_transportmittel_fahrzeugtyp ON transportmittel(fahrzeugtyp);

-- 2) Typ-Backfill aus icon / Name
UPDATE transportmittel SET fahrzeugtyp = 'dachbox'
WHERE icon = 'package' OR LOWER(name) LIKE '%dachbox%';

UPDATE transportmittel SET fahrzeugtyp = 'hecktraeger'
WHERE icon = 'box' OR LOWER(name) LIKE '%heckbox%' OR LOWER(name) LIKE '%heckträger%' OR LOWER(name) LIKE '%hecktraeger%';

UPDATE transportmittel SET fahrzeugtyp = 'anhaenger'
WHERE icon = 'container'
   OR LOWER(name) LIKE '%anhänger%'
   OR LOWER(name) LIKE '%anhaenger%'
   OR LOWER(name) LIKE '%trailer%';

UPDATE transportmittel SET fahrzeugtyp = 'wohnmobil'
WHERE icon = 'bus' OR LOWER(name) LIKE '%wohnmobil%';

UPDATE transportmittel SET fahrzeugtyp = 'wohnwagen'
WHERE icon = 'caravan'
   OR LOWER(name) LIKE '%wohnwagen%'
   OR LOWER(name) LIKE '%caravan%';

UPDATE transportmittel SET fahrzeugtyp = 'kastenwagen'
WHERE icon = 'van' OR icon = 'truck'
   OR LOWER(name) LIKE '%kastenwagen%';

UPDATE transportmittel SET fahrzeugtyp = 'faltcaravan'
WHERE LOWER(name) LIKE '%faltcaravan%' OR LOWER(name) LIKE '%faltwohnwagen%';

UPDATE transportmittel SET fahrzeugtyp = 'auto'
WHERE icon = 'car' OR LOWER(name) LIKE '%auto%' OR LOWER(name) LIKE '%pkw%';

-- Anbauten: max_traglast aus bisheriger Zuladung ableiten, wenn möglich
UPDATE transportmittel
SET max_traglast = CASE
  WHEN zul_gesamtgewicht > eigengewicht THEN zul_gesamtgewicht - eigengewicht
  ELSE zul_gesamtgewicht
END
WHERE fahrzeugtyp IN ('dachbox', 'hecktraeger')
  AND (max_traglast IS NULL OR max_traglast <= 0);

-- 3) Urlaub ↔ Transportmittel
CREATE TABLE IF NOT EXISTS urlaub_transportmittel (
    urlaub_id TEXT NOT NULL,
    transport_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (urlaub_id, transport_id),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_urlaub_transportmittel_urlaub ON urlaub_transportmittel(urlaub_id);
CREATE INDEX IF NOT EXISTS idx_urlaub_transportmittel_transport ON urlaub_transportmittel(transport_id);

-- Bestands-Urlaube: alle aktuellen Transportmittel (bisheriges Verhalten)
INSERT OR IGNORE INTO urlaub_transportmittel (urlaub_id, transport_id)
SELECT u.id, t.id
FROM urlaube u
CROSS JOIN transportmittel t;

-- 4) Personengewichte
ALTER TABLE mitreisende ADD COLUMN koerpergewicht REAL;
ALTER TABLE urlaub_mitreisende ADD COLUMN transport_id TEXT REFERENCES transportmittel(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_urlaub_mitreisende_transport ON urlaub_mitreisende(transport_id);
