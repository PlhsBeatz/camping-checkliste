-- Medium ↔ Ausrüstung: nur Relevanz für Reichweiten-Prüfung (Packliste / Fest Installiert)

CREATE TABLE IF NOT EXISTS verbrauch_medien_ausruestung (
    medium_id TEXT NOT NULL,
    equipment_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (medium_id, equipment_id),
    FOREIGN KEY (medium_id) REFERENCES verbrauch_medien(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verbrauch_medien_ausruestung_equipment
  ON verbrauch_medien_ausruestung(equipment_id);
