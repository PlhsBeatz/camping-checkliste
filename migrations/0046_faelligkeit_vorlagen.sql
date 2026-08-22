-- Migration 0046: Wartungs-Vorlagen (Fälligkeiten)
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0046_faelligkeit_vorlagen.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0046_faelligkeit_vorlagen.sql

CREATE TABLE IF NOT EXISTS faelligkeit_vorlagen (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kategorie TEXT NOT NULL DEFAULT 'sonstiges'
        CHECK (kategorie IN ('sicherheit', 'fahrzeug', 'ausruestung', 'versicherung', 'sonstiges')),
    typ TEXT NOT NULL DEFAULT 'festes_datum'
        CHECK (typ IN ('festes_datum', 'intervall', 'alter_anzeige')),
    intervall_einheit TEXT CHECK (intervall_einheit IS NULL OR intervall_einheit IN ('tage', 'monate', 'jahre')),
    intervall_wert INTEGER,
    intervall_rhythmus TEXT NOT NULL DEFAULT 'taggenau'
        CHECK (intervall_rhythmus IN ('taggenau', 'monatsende')),
    warnung_tage_vorher INTEGER NOT NULL DEFAULT 30,
    sicherheitsrelevant INTEGER NOT NULL DEFAULT 0,
    quittierung_erforderlich INTEGER NOT NULL DEFAULT 0,
    notizen TEXT,
    hinweis TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_faelligkeit_vorlagen_sort ON faelligkeit_vorlagen(sort_order, name);

CREATE TRIGGER IF NOT EXISTS update_faelligkeit_vorlagen_timestamp
AFTER UPDATE ON faelligkeit_vorlagen
BEGIN
  UPDATE faelligkeit_vorlagen SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Standard-Vorlagen (bisher im Code)
INSERT OR IGNORE INTO faelligkeit_vorlagen (
    id, name, kategorie, typ, intervall_einheit, intervall_wert, intervall_rhythmus,
    warnung_tage_vorher, sicherheitsrelevant, quittierung_erforderlich, notizen, hinweis, sort_order
) VALUES
('gaspruefung', 'Gasprüfung (Anlage)', 'sicherheit', 'intervall', 'monate', 24, 'taggenau', 60, 1, 0, NULL, 'Typischerweise alle 2 Jahre – bitte mit Prüfstelle/Hersteller abgleichen.', 10),
('gasschlauch', 'Gasschlauch', 'sicherheit', 'alter_anzeige', 'jahre', 10, 'taggenau', 90, 1, 0, 'Herstelldatum auf dem Schlauch eintragen.', 'Austausch oft 10 Jahre ab Herstelldatum – Herstellerangaben beachten.', 20),
('druckminderer', 'Druckminderer', 'sicherheit', 'alter_anzeige', 'jahre', 10, 'taggenau', 90, 1, 0, NULL, 'Austauschintervall laut Hersteller prüfen.', 30),
('wasserfilter', 'Wasserfilter', 'ausruestung', 'intervall', 'monate', 12, 'taggenau', 30, 0, 0, NULL, NULL, 40),
('frischwasserfilter', 'Frischwasserfilter', 'ausruestung', 'intervall', 'monate', 12, 'taggenau', 30, 0, 0, NULL, NULL, 50),
('gasheizung_zuendbatterie', 'Zündbatterie Gasheizung', 'sicherheit', 'intervall', 'monate', 12, 'taggenau', 14, 1, 1, NULL, NULL, 60),
('tuev_hu', 'HU / TÜV', 'fahrzeug', 'intervall', 'monate', 24, 'monatsende', 60, 0, 0, NULL, 'Nächste HU fällig zum Monatsende, 24 Monate nach letzter Erledigung.', 70),
('dichtigkeitspruefung', 'Dichtigkeitsprüfung', 'sicherheit', 'intervall', 'monate', 24, 'taggenau', 30, 1, 0, NULL, NULL, 80),
('co_melder', 'CO-Melder Batterie', 'sicherheit', 'intervall', 'jahre', 5, 'taggenau', 30, 1, 0, NULL, NULL, 90),
('feuerloescher', 'Feuerlöscher Prüfung', 'sicherheit', 'intervall', 'jahre', 2, 'taggenau', 30, 0, 0, NULL, NULL, 100),
('versicherung', 'Versicherung', 'versicherung', 'festes_datum', NULL, NULL, 'taggenau', 60, 0, 0, NULL, NULL, 110),
('schutzbrief_adac', 'Schutzbrief / ADAC', 'versicherung', 'festes_datum', NULL, NULL, 'taggenau', 30, 0, 0, NULL, NULL, 120),
('starterbatterie', 'Starterbatterie Wohnmobil', 'fahrzeug', 'intervall', 'jahre', 4, 'taggenau', 60, 0, 0, NULL, NULL, 130),
('reifen_tempo100', 'Reifen (Tempo 100)', 'fahrzeug', 'alter_anzeige', NULL, NULL, 'taggenau', 60, 0, 0, 'Bei Tempo-100-Zulassung: Gültig-bis-Datum eintragen, sonst nur Baujahr.', NULL, 140);
