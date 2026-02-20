-- 1. Basis-Tabellen (ohne Fremdschlüssel)
CREATE TABLE IF NOT EXISTS hauptkategorien (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL UNIQUE,
    reihenfolge INTEGER,
    pauschalgewicht REAL,
    pauschal_pro_person INTEGER DEFAULT 0,
    pauschal_transport_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transportmittel (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    zul_gesamtgewicht REAL NOT NULL,
    eigengewicht REAL NOT NULL,
    fest_installiert_mitrechnen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (zul_gesamtgewicht > 0),
    CHECK (eigengewicht >= 0)
);

CREATE TABLE IF NOT EXISTS transportmittel_festgewicht_manuell (
    id TEXT PRIMARY KEY,
    transport_id TEXT NOT NULL,
    titel TEXT NOT NULL,
    gewicht REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (gewicht >= 0),
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mitreisende (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT UNIQUE,
    is_default_member INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS urlaube (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    startdatum TEXT NOT NULL,
    abfahrtdatum TEXT,
    enddatum TEXT,
    reiseziel_name TEXT,
    reiseziel_adresse TEXT,
    land_region TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS packlisten_vorlagen (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL UNIQUE,
    beschreibung TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  farbe TEXT,
  icon TEXT,
  beschreibung TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 2. Tabellen mit Abhängigkeiten Ebene 1
CREATE TABLE IF NOT EXISTS kategorien (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    hauptkategorie_id TEXT NOT NULL,
    reihenfolge INTEGER,
    pauschalgewicht REAL,
    pauschal_pro_person INTEGER DEFAULT 0,
    pauschal_transport_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (hauptkategorie_id, titel),
    FOREIGN KEY (hauptkategorie_id) REFERENCES hauptkategorien(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS packlisten (
    id TEXT PRIMARY KEY,
    urlaub_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS urlaub_mitreisende (
    urlaub_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (urlaub_id, mitreisender_id),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);

-- 3. Tabellen mit Abhängigkeiten Ebene 2 (Haupt-Gegenstände)
CREATE TABLE IF NOT EXISTS ausruestungsgegenstaende (
    id TEXT PRIMARY KEY,
    was TEXT NOT NULL,
    kategorie_id TEXT NOT NULL,
    transport_id TEXT,
    einzelgewicht REAL,
    standard_anzahl INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Normal',
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), 
    mitreisenden_typ TEXT NOT NULL DEFAULT 'pauschal' CHECK (mitreisenden_typ IN ('pauschal', 'alle', 'ausgewaehlte')), is_standard INTEGER DEFAULT 0,
    in_pauschale_inbegriffen INTEGER DEFAULT 0,
    CHECK (einzelgewicht >= 0 OR einzelgewicht IS NULL),
    CHECK (standard_anzahl >= 0),
    CHECK (status IN ('Normal', 'Ausgemustert', 'Fest Installiert', 'Immer gepackt')),
    FOREIGN KEY (kategorie_id) REFERENCES kategorien(id) ON DELETE RESTRICT,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE SET NULL
);

-- 4. Tabellen mit Abhängigkeiten Ebene 3 (Verknüpfungen)
CREATE TABLE IF NOT EXISTS ausruestungsgegenstaende_links (
    id TEXT PRIMARY KEY,
    gegenstand_id TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ausruestungsgegenstaende_standard_mitreisende (
    gegenstand_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (gegenstand_id, mitreisender_id),
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ausruestungsgegenstaende_tags (
  gegenstand_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (gegenstand_id, tag_id),
  FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vorlagen_eintraege (
    vorlage_id TEXT NOT NULL,
    gegenstand_id TEXT NOT NULL,
    anzahl INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (vorlage_id, gegenstand_id),
    CHECK (anzahl >= 0 OR anzahl IS NULL),
    FOREIGN KEY (vorlage_id) REFERENCES packlisten_vorlagen(id) ON DELETE CASCADE,
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS packlisten_eintraege (
    id TEXT PRIMARY KEY,
    packliste_id TEXT NOT NULL,
    gegenstand_id TEXT NOT NULL,
    anzahl INTEGER NOT NULL,
    gepackt INTEGER NOT NULL DEFAULT 0,
    bemerkung TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), transport_id TEXT,
    UNIQUE (packliste_id, gegenstand_id),
    CHECK (anzahl >= 0),
    FOREIGN KEY (packliste_id) REFERENCES packlisten(id) ON DELETE CASCADE,
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS packlisten_eintrag_mitreisende (
    packlisten_eintrag_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), gepackt INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (packlisten_eintrag_id, mitreisender_id),
    FOREIGN KEY (packlisten_eintrag_id) REFERENCES packlisten_eintraege(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);

-- 5. Indizes
CREATE INDEX idx_kategorien_hauptkategorie_id ON kategorien(hauptkategorie_id);
CREATE INDEX idx_ausruestungsgegenstaende_kategorie_id ON ausruestungsgegenstaende(kategorie_id);
CREATE INDEX idx_ausruestungsgegenstaende_transport_id ON ausruestungsgegenstaende(transport_id);
CREATE INDEX idx_ausruestungsgegenstaende_links_gegenstand_id ON ausruestungsgegenstaende_links(gegenstand_id);
CREATE INDEX idx_mitreisende_user_id ON mitreisende(user_id);
CREATE INDEX idx_urlaub_mitreisende_urlaub_id ON urlaub_mitreisende(urlaub_id);
CREATE INDEX idx_urlaub_mitreisende_mitreisender_id ON urlaub_mitreisende(mitreisender_id);
CREATE INDEX idx_packlisten_urlaub_id ON packlisten(urlaub_id);
CREATE INDEX idx_packlisten_eintraege_packliste_id ON packlisten_eintraege(packliste_id);
CREATE INDEX idx_packlisten_eintraege_gegenstand_id ON packlisten_eintraege(gegenstand_id);
CREATE INDEX idx_packlisten_eintrag_mitreisende_packlisten_eintrag_id ON packlisten_eintrag_mitreisende(packlisten_eintrag_id);
CREATE INDEX idx_packlisten_eintrag_mitreisende_mitreisender_id ON packlisten_eintrag_mitreisende(mitreisender_id);
CREATE INDEX idx_vorlagen_eintraege_vorlage_id ON vorlagen_eintraege(vorlage_id);
CREATE INDEX idx_vorlagen_eintraege_gegenstand_id ON vorlagen_eintraege(gegenstand_id);
CREATE INDEX idx_packlisten_eintraege_transport_id ON packlisten_eintraege(transport_id);
CREATE INDEX idx_ausruestungsgegenstaende_mitreisenden_typ ON ausruestungsgegenstaende(mitreisenden_typ);
CREATE INDEX idx_ausruestungsgegenstaende_standard_mitreisende_gegenstand_id ON ausruestungsgegenstaende_standard_mitreisende(gegenstand_id);
CREATE INDEX idx_ausruestungsgegenstaende_standard_mitreisende_mitreisender_id ON ausruestungsgegenstaende_standard_mitreisende(mitreisender_id);
CREATE INDEX idx_packlisten_eintrag_mitreisende_gepackt ON packlisten_eintrag_mitreisende(gepackt);
CREATE INDEX idx_tags_titel ON tags(titel);
CREATE INDEX idx_ausruestungsgegenstaende_tags_gegenstand ON ausruestungsgegenstaende_tags(gegenstand_id);
CREATE INDEX idx_ausruestungsgegenstaende_tags_tag ON ausruestungsgegenstaende_tags(tag_id);
CREATE INDEX idx_ausruestungsgegenstaende_is_standard ON ausruestungsgegenstaende(is_standard);
CREATE INDEX idx_transportmittel_festgewicht_manuell_transport_id ON transportmittel_festgewicht_manuell(transport_id);

-- 6. Trigger
CREATE TRIGGER update_hauptkategorien_timestamp AFTER UPDATE ON hauptkategorien BEGIN UPDATE hauptkategorien SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_kategorien_timestamp AFTER UPDATE ON kategorien BEGIN UPDATE kategorien SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_transportmittel_timestamp AFTER UPDATE ON transportmittel BEGIN UPDATE transportmittel SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_ausruestungsgegenstaende_timestamp AFTER UPDATE ON ausruestungsgegenstaende BEGIN UPDATE ausruestungsgegenstaende SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_mitreisende_timestamp AFTER UPDATE ON mitreisende BEGIN UPDATE mitreisende SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_urlaube_timestamp AFTER UPDATE ON urlaube BEGIN UPDATE urlaube SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_packlisten_timestamp AFTER UPDATE ON packlisten BEGIN UPDATE packlisten SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_packlisten_eintraege_timestamp AFTER UPDATE ON packlisten_eintraege BEGIN UPDATE packlisten_eintraege SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_packlisten_vorlagen_timestamp AFTER UPDATE ON packlisten_vorlagen BEGIN UPDATE packlisten_vorlagen SET updated_at = datetime('now') WHERE id = NEW.id; END;