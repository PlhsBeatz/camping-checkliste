-- SQLite Schema for Camping Packing List App
-- Adapted from PostgreSQL schema for Cloudflare D1/SQLite compatibility
-- Version 1.0

-- Table: Hauptkategorien (Main Categories)
CREATE TABLE hauptkategorien (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL UNIQUE,
    reihenfolge INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table: Kategorien (Categories)
CREATE TABLE kategorien (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL,
    hauptkategorie_id TEXT NOT NULL,
    reihenfolge INTEGER,
    pauschalgewicht REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (hauptkategorie_id, titel),
    FOREIGN KEY (hauptkategorie_id) REFERENCES hauptkategorien(id) ON DELETE RESTRICT
);
CREATE INDEX idx_kategorien_hauptkategorie_id ON kategorien(hauptkategorie_id);

-- Table: Transportmittel (Transport Vehicles)
CREATE TABLE transportmittel (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    zul_gesamtgewicht REAL NOT NULL,
    eigengewicht REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (zul_gesamtgewicht > 0),
    CHECK (eigengewicht >= 0)
);

-- Table: Ausrüstungsgegenstände (Equipment Items)
CREATE TABLE ausruestungsgegenstaende (
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
    CHECK (einzelgewicht >= 0 OR einzelgewicht IS NULL),
    CHECK (standard_anzahl >= 0),
    CHECK (status IN ('Normal', 'Ausgemustert', 'Fest Installiert', 'Immer gepackt')),
    FOREIGN KEY (kategorie_id) REFERENCES kategorien(id) ON DELETE RESTRICT,
    FOREIGN KEY (transport_id) REFERENCES transportmittel(id) ON DELETE SET NULL
);
CREATE INDEX idx_ausruestungsgegenstaende_kategorie_id ON ausruestungsgegenstaende(kategorie_id);
CREATE INDEX idx_ausruestungsgegenstaende_transport_id ON ausruestungsgegenstaende(transport_id);

-- Table: Links (Equipment Item Links - replacing TEXT[] with separate table)
CREATE TABLE ausruestungsgegenstaende_links (
    id TEXT PRIMARY KEY,
    gegenstand_id TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE
);
CREATE INDEX idx_ausruestungsgegenstaende_links_gegenstand_id ON ausruestungsgegenstaende_links(gegenstand_id);

-- Table: Mitreisende (Travelers)
CREATE TABLE mitreisende (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    user_id TEXT UNIQUE,
    is_default_member INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mitreisende_user_id ON mitreisende(user_id);

-- Table: Urlaube (Vacations)
CREATE TABLE urlaube (
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

-- Table: Urlaub_Mitreisende (Junction Table: Vacations <-> Travelers)
CREATE TABLE urlaub_mitreisende (
    urlaub_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (urlaub_id, mitreisender_id),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);
CREATE INDEX idx_urlaub_mitreisende_urlaub_id ON urlaub_mitreisende(urlaub_id);
CREATE INDEX idx_urlaub_mitreisende_mitreisender_id ON urlaub_mitreisende(mitreisender_id);

-- Table: Packlisten (Packing Lists)
CREATE TABLE packlisten (
    id TEXT PRIMARY KEY,
    urlaub_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (urlaub_id) REFERENCES urlaube(id) ON DELETE CASCADE
);
CREATE INDEX idx_packlisten_urlaub_id ON packlisten(urlaub_id);

-- Table: Packlisten_Einträge (Packing List Items)
CREATE TABLE packlisten_eintraege (
    id TEXT PRIMARY KEY,
    packliste_id TEXT NOT NULL,
    gegenstand_id TEXT NOT NULL,
    anzahl INTEGER NOT NULL,
    gepackt INTEGER NOT NULL DEFAULT 0,
    bemerkung TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (packliste_id, gegenstand_id),
    CHECK (anzahl >= 0),
    FOREIGN KEY (packliste_id) REFERENCES packlisten(id) ON DELETE CASCADE,
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE RESTRICT
);
CREATE INDEX idx_packlisten_eintraege_packliste_id ON packlisten_eintraege(packliste_id);
CREATE INDEX idx_packlisten_eintraege_gegenstand_id ON packlisten_eintraege(gegenstand_id);

-- Table: Packlisten_Eintrag_Mitreisende (Junction Table: Packing List Items <-> Travelers)
CREATE TABLE packlisten_eintrag_mitreisende (
    packlisten_eintrag_id TEXT NOT NULL,
    mitreisender_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (packlisten_eintrag_id, mitreisender_id),
    FOREIGN KEY (packlisten_eintrag_id) REFERENCES packlisten_eintraege(id) ON DELETE CASCADE,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE
);
CREATE INDEX idx_packlisten_eintrag_mitreisende_packlisten_eintrag_id ON packlisten_eintrag_mitreisende(packlisten_eintrag_id);
CREATE INDEX idx_packlisten_eintrag_mitreisende_mitreisender_id ON packlisten_eintrag_mitreisende(mitreisender_id);

-- Table: Packlisten_Vorlagen (Packing List Templates)
CREATE TABLE packlisten_vorlagen (
    id TEXT PRIMARY KEY,
    titel TEXT NOT NULL UNIQUE,
    beschreibung TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Table: Vorlagen_Einträge (Junction Table: Templates <-> Equipment Items)
CREATE TABLE vorlagen_eintraege (
    vorlage_id TEXT NOT NULL,
    gegenstand_id TEXT NOT NULL,
    anzahl INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (vorlage_id, gegenstand_id),
    CHECK (anzahl >= 0 OR anzahl IS NULL),
    FOREIGN KEY (vorlage_id) REFERENCES packlisten_vorlagen(id) ON DELETE CASCADE,
    FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE
);
CREATE INDEX idx_vorlagen_eintraege_vorlage_id ON vorlagen_eintraege(vorlage_id);
CREATE INDEX idx_vorlagen_eintraege_gegenstand_id ON vorlagen_eintraege(gegenstand_id);

-- Create triggers to update the updated_at timestamp
CREATE TRIGGER update_hauptkategorien_timestamp AFTER UPDATE ON hauptkategorien
BEGIN
    UPDATE hauptkategorien SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_kategorien_timestamp AFTER UPDATE ON kategorien
BEGIN
    UPDATE kategorien SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_transportmittel_timestamp AFTER UPDATE ON transportmittel
BEGIN
    UPDATE transportmittel SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_ausruestungsgegenstaende_timestamp AFTER UPDATE ON ausruestungsgegenstaende
BEGIN
    UPDATE ausruestungsgegenstaende SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_mitreisende_timestamp AFTER UPDATE ON mitreisende
BEGIN
    UPDATE mitreisende SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_urlaube_timestamp AFTER UPDATE ON urlaube
BEGIN
    UPDATE urlaube SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_packlisten_timestamp AFTER UPDATE ON packlisten
BEGIN
    UPDATE packlisten SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_packlisten_eintraege_timestamp AFTER UPDATE ON packlisten_eintraege
BEGIN
    UPDATE packlisten_eintraege SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER update_packlisten_vorlagen_timestamp AFTER UPDATE ON packlisten_vorlagen
BEGIN
    UPDATE packlisten_vorlagen SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Insert sample data for testing
INSERT INTO hauptkategorien (id, titel, reihenfolge) VALUES 
('hk1', 'Campingausrüstung', 1),
('hk2', 'Küche & Co.', 2),
('hk3', 'Lebensmittel', 3),
('hk4', 'Sonstiges', 4),
('hk5', 'Klamotten', 5),
('hk6', 'Kosmetik', 6),
('hk7', 'Reiseapotheke', 7),
('hk8', 'Kinder', 8);

INSERT INTO kategorien (id, titel, hauptkategorie_id, reihenfolge) VALUES 
('k1', 'Wohnwagen', 'hk1', 1),
('k2', 'Vorzelt', 'hk1', 2),
('k3', 'Wäsche', 'hk1', 3),
('k4', 'Ordnung & Organisation', 'hk1', 4),
('k5', 'Werkzeug', 'hk1', 5),
('k6', 'Grundausstattung', 'hk2', 1),
('k7', 'Geschirr', 'hk2', 3),
('k8', 'Kochen und Grillen', 'hk2', 5);

INSERT INTO transportmittel (id, name, zul_gesamtgewicht, eigengewicht) VALUES 
('t1', 'Wohnwagen', 2000.0, 1475.0),
('t2', 'Auto', 2500.0, 1800.0);

INSERT INTO ausruestungsgegenstaende (id, was, kategorie_id, transport_id, einzelgewicht, standard_anzahl, status, details) VALUES 
('g1', 'Sitzplatten', 'k1', 't1', 2.50, 1, 'Fest Installiert', 'ALKO Big-Foots'),
('g2', 'Gasflasche Alugas (11kg)', 'k1', 't1', 16.50, 1, 'Fest Installiert', 'Alugas 11kg'),
('g3', 'Gasflasche Stahl (5kg)', 'k1', 't2', 11.60, 1, 'Normal', 'graue Stahlflasche'),
('g4', 'Gießkanne', 'k1', 't1', 0.58, 1, 'Immer gepackt', 'Gießkanne gelb Kunststoff 14 L'),
('g5', 'Abwasserschlauch', 'k1', 't1', 1.00, 3, 'Immer gepackt', 'RK Reich Abwasser-Entsorgungs-Set');

INSERT INTO ausruestungsgegenstaende_links (id, gegenstand_id, url) VALUES 
('l1', 'g4', 'https://www.hornbach.de/shop/Giesskanne-gel-Kunststoff-14-l/5106779/artikel.html'),
('l2', 'g5', 'https://www.campingwagner.de/product_info.php/info/p1005_RK-Reich-Abwasser-Entsorgungs-Set.html');

INSERT INTO mitreisende (id, name, is_default_member) VALUES 
('m1', 'Ich', 1),
('m2', 'Partnerin', 1),
('m3', 'Kind 1', 1),
('m4', 'Kind 2', 1);

INSERT INTO urlaube (id, titel, startdatum, enddatum, reiseziel_name) VALUES 
('u1', 'Sommerurlaub 2025', '2025-07-15', '2025-07-30', 'Campingplatz am See');

INSERT INTO urlaub_mitreisende (urlaub_id, mitreisender_id) VALUES 
('u1', 'm1'),
('u1', 'm2'),
('u1', 'm3'),
('u1', 'm4');

INSERT INTO packlisten (id, urlaub_id) VALUES 
('p1', 'u1');

INSERT INTO packlisten_eintraege (id, packliste_id, gegenstand_id, anzahl, gepackt) VALUES 
('pe1', 'p1', 'g1', 1, 1),
('pe2', 'p1', 'g2', 1, 1),
('pe3', 'p1', 'g3', 1, 0),
('pe4', 'p1', 'g4', 1, 0),
('pe5', 'p1', 'g5', 3, 0);

INSERT INTO packlisten_vorlagen (id, titel, beschreibung) VALUES 
('v1', 'Grundausstattung', 'Basis-Ausrüstung für jeden Campingurlaub'),
('v2', 'Sommerurlaub', 'Zusätzliche Ausrüstung für Sommerurlaube');

INSERT INTO vorlagen_eintraege (vorlage_id, gegenstand_id, anzahl) VALUES 
('v1', 'g1', 1),
('v1', 'g2', 1),
('v1', 'g3', 1),
('v1', 'g4', 1),
('v2', 'g5', 3);
