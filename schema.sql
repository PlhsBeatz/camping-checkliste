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
    icon TEXT,
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
    packliste_default_ansicht TEXT DEFAULT 'packliste',
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

CREATE TABLE IF NOT EXISTS tag_kategorien (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO tag_kategorien (id, titel, reihenfolge) VALUES
  ('tag-kat-zeit', 'Zeit', 0),
  ('tag-kat-aktivitaeten', 'Aktivitäten', 1),
  ('tag-kat-reiseziel', 'Reiseziel', 2);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  farbe TEXT,
  icon TEXT,
  beschreibung TEXT,
  tag_kategorie_id TEXT NOT NULL,
  reihenfolge INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tag_kategorie_id) REFERENCES tag_kategorien(id) ON DELETE RESTRICT
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
    mengenregel TEXT,
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
    einzelgewicht_override REAL,
    UNIQUE (packliste_id, gegenstand_id),
    CHECK (anzahl >= 0),
    FOREIGN KEY (packliste_id) REFERENCES packlisten(id) ON DELETE CASCADE,
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS packlisten_eintrag_mitreisende (
    packlisten_eintrag_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), gepackt INTEGER NOT NULL DEFAULT 0,
    transport_id TEXT,
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
CREATE INDEX idx_tags_tag_kategorie_id ON tags(tag_kategorie_id);
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

-- Checklisten (Tools)
CREATE TABLE IF NOT EXISTS checklisten (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklisten_kategorien (
    id TEXT PRIMARY KEY,
    checklist_id TEXT NOT NULL,
    titel TEXT NOT NULL,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (checklist_id) REFERENCES checklisten(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklisten_eintraege (
    id TEXT PRIMARY KEY,
    checklist_id TEXT NOT NULL,
    kategorie_id TEXT NOT NULL,
    text TEXT NOT NULL,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    erledigt INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (checklist_id) REFERENCES checklisten(id) ON DELETE CASCADE,
    FOREIGN KEY (kategorie_id) REFERENCES checklisten_kategorien(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checklisten_kategorien_checklist_id ON checklisten_kategorien(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklisten_eintraege_checklist_id ON checklisten_eintraege(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklisten_eintraege_kategorie_id ON checklisten_eintraege(kategorie_id);

CREATE TRIGGER IF NOT EXISTS update_checklisten_timestamp AFTER UPDATE ON checklisten BEGIN UPDATE checklisten SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS update_checklisten_kategorien_timestamp AFTER UPDATE ON checklisten_kategorien BEGIN UPDATE checklisten_kategorien SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS update_checklisten_eintraege_timestamp AFTER UPDATE ON checklisten_eintraege BEGIN UPDATE checklisten_eintraege SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- Optimierungen (Tools, Admin-Backlog)
CREATE TABLE IF NOT EXISTS optimierungen (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    notiz TEXT,
    bereich TEXT NOT NULL DEFAULT 'ausstattung',
    status TEXT NOT NULL DEFAULT 'idee',
    prioritaet TEXT,
    zeitfenster TEXT,
    zeit_jahr INTEGER,
    zeit_notiz TEXT,
    faelligkeit_modus TEXT,
    faellig_am TEXT,
    faelligkeit_bezug_am TEXT,
    push_reminder_4w_sent INTEGER NOT NULL DEFAULT 0,
    push_reminder_2w_sent INTEGER NOT NULL DEFAULT 0,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_optimierungen_status ON optimierungen(status);

CREATE TRIGGER IF NOT EXISTS update_optimierungen_timestamp
AFTER UPDATE ON optimierungen
BEGIN
  UPDATE optimierungen SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS optimierungen_links (
    id TEXT PRIMARY KEY,
    optimierung_id TEXT NOT NULL,
    url TEXT NOT NULL,
    reihenfolge INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (optimierung_id) REFERENCES optimierungen(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_optimierungen_links_optimierung_id
  ON optimierungen_links(optimierung_id);

CREATE TABLE IF NOT EXISTS optimierungen_fotos (
    id TEXT PRIMARY KEY,
    optimierung_id TEXT NOT NULL,
    sort_index INTEGER NOT NULL DEFAULT 0,
    r2_object_key TEXT,
    content_type TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (optimierung_id) REFERENCES optimierungen(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_optimierungen_fotos_optimierung_id
  ON optimierungen_fotos(optimierung_id);

-- Wartung: Fälligkeiten, Historie, Verbrauch, Vorlagen
CREATE TABLE IF NOT EXISTS faelligkeiten (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kategorie TEXT NOT NULL DEFAULT 'sonstiges'
        CHECK (kategorie IN ('sicherheit', 'fahrzeug', 'ausruestung', 'versicherung', 'sonstiges')),
    typ TEXT NOT NULL DEFAULT 'festes_datum'
        CHECK (typ IN ('festes_datum', 'intervall', 'alter_anzeige')),
    equipment_id TEXT,
    transport_id TEXT,
    bezug_datum TEXT,
    gueltig_bis TEXT,
    letzte_erledigung_am TEXT,
    initial_erledigung_am TEXT,
    naechste_faelligkeit TEXT,
    intervall_einheit TEXT CHECK (intervall_einheit IS NULL OR intervall_einheit IN ('tage', 'monate', 'jahre')),
    intervall_wert INTEGER,
    intervall_rhythmus TEXT NOT NULL DEFAULT 'taggenau'
        CHECK (intervall_rhythmus IN ('taggenau', 'monatsende')),
    warnung_tage_vorher INTEGER NOT NULL DEFAULT 30,
    sicherheitsrelevant INTEGER NOT NULL DEFAULT 0,
    quittierung_erforderlich INTEGER NOT NULL DEFAULT 0,
    push_reminder_sent INTEGER NOT NULL DEFAULT 0,
    push_due_sent INTEGER NOT NULL DEFAULT 0,
    notizen TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (equipment_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE SET NULL,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS faelligkeiten_historie (
    id TEXT PRIMARY KEY,
    faelligkeit_id TEXT NOT NULL,
    ereignis_typ TEXT NOT NULL CHECK (ereignis_typ IN ('erledigt', 'quittiert', 'notiz')),
    datum TEXT NOT NULL,
    user_id TEXT,
    notiz TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (faelligkeit_id) REFERENCES faelligkeiten(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verbrauch_messungen (
    id TEXT PRIMARY KEY,
    typ TEXT NOT NULL DEFAULT 'gas'
        CHECK (typ IN ('gas', 'wasser', 'strom', 'adblue', 'sonstiges')),
    urlaub_id TEXT,
    equipment_id TEXT,
    transport_id TEXT,
    messdatum_start TEXT,
    messdatum_ende TEXT,
    wert_start REAL,
    wert_ende REAL,
    einheit TEXT NOT NULL DEFAULT 'kg',
    verbrauch_gesamt REAL,
    verbrauch_pro_tag REAL,
    notizen TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE SET NULL,
    FOREIGN KEY (equipment_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE SET NULL,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE SET NULL
);

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

CREATE INDEX IF NOT EXISTS idx_faelligkeiten_naechste ON faelligkeiten(naechste_faelligkeit);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_equipment ON faelligkeiten(equipment_id);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_transport ON faelligkeiten(transport_id);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_archived ON faelligkeiten(is_archived);
CREATE INDEX IF NOT EXISTS idx_faelligkeiten_historie_faelligkeit ON faelligkeiten_historie(faelligkeit_id, datum);
CREATE INDEX IF NOT EXISTS idx_verbrauch_urlaub ON verbrauch_messungen(urlaub_id);
CREATE INDEX IF NOT EXISTS idx_verbrauch_typ ON verbrauch_messungen(typ);
CREATE INDEX IF NOT EXISTS idx_faelligkeit_vorlagen_sort ON faelligkeit_vorlagen(sort_order, name);

CREATE TRIGGER IF NOT EXISTS update_faelligkeiten_timestamp
AFTER UPDATE ON faelligkeiten
BEGIN
  UPDATE faelligkeiten SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_faelligkeit_vorlagen_timestamp
AFTER UPDATE ON faelligkeit_vorlagen
BEGIN
  UPDATE faelligkeit_vorlagen SET updated_at = datetime('now') WHERE id = NEW.id;
END;