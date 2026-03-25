-- Checklisten (Tools): Listen, eine Kategorieebene, Einträge mit gemeinsamem erledigt-Status

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

CREATE TRIGGER update_checklisten_timestamp AFTER UPDATE ON checklisten BEGIN UPDATE checklisten SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_checklisten_kategorien_timestamp AFTER UPDATE ON checklisten_kategorien BEGIN UPDATE checklisten_kategorien SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER update_checklisten_eintraege_timestamp AFTER UPDATE ON checklisten_eintraege BEGIN UPDATE checklisten_eintraege SET updated_at = datetime('now') WHERE id = NEW.id; END;

-- Seed: nur wenn noch keine Checklisten existieren
INSERT OR IGNORE INTO checklisten (id, titel, reihenfolge) VALUES
  ('chk_abfahrt', 'Wohnwagen Abfahrt Checkliste', 0),
  ('chk_einwintern', 'Wohnwagen Winterfest machen', 1);

INSERT OR IGNORE INTO checklisten_kategorien (id, checklist_id, titel, reihenfolge) VALUES
  ('cat_abf_innen', 'chk_abfahrt', 'INNEN', 0),
  ('cat_abf_aussen', 'chk_abfahrt', 'AUSSEN', 1),
  ('cat_abf_auto', 'chk_abfahrt', 'AUTO', 2),
  ('cat_ein_ent', 'chk_einwintern', 'Entrümpeln', 0),
  ('cat_ein_pflege', 'chk_einwintern', 'Pflege und Reinigung', 1),
  ('cat_ein_lueft', 'chk_einwintern', 'Lüftung', 2),
  ('cat_ein_scharn', 'chk_einwintern', 'Scharniere und Schlösser fetten', 3),
  ('cat_ein_wasser', 'chk_einwintern', 'Wasser', 4),
  ('cat_ein_sonst', 'chk_einwintern', 'Sonstiges', 5);

INSERT OR IGNORE INTO checklisten_eintraege (id, checklist_id, kategorie_id, text, reihenfolge, erledigt) VALUES
  ('e_ab_i01', 'chk_abfahrt', 'cat_abf_innen', 'Schrankinhalt: Behälter mit Flüssigkeiten gut verschließen und verstauen', 0, 0),
  ('e_ab_i02', 'chk_abfahrt', 'cat_abf_innen', 'Tisch einrasten', 1, 0),
  ('e_ab_i03', 'chk_abfahrt', 'cat_abf_innen', 'Frischwasser auffüllen', 2, 0),
  ('e_ab_i04', 'chk_abfahrt', 'cat_abf_innen', 'Toilette leeren', 3, 0),
  ('e_ab_i05', 'chk_abfahrt', 'cat_abf_innen', 'Toilettenschieber schließen', 4, 0),
  ('e_ab_i06', 'chk_abfahrt', 'cat_abf_innen', 'Toilettendeckel schließen', 5, 0),
  ('e_ab_i07', 'chk_abfahrt', 'cat_abf_innen', 'Abwasserbehälter leeren und sicher verstauen', 6, 0),
  ('e_ab_i08', 'chk_abfahrt', 'cat_abf_innen', 'Licht im Wohnwagen ausschalten', 7, 0),
  ('e_ab_i09', 'chk_abfahrt', 'cat_abf_innen', 'Rollos öffnen', 8, 0),
  ('e_ab_i10', 'chk_abfahrt', 'cat_abf_innen', 'Schubladen und Schranktüren schließen und verriegeln', 9, 0),
  ('e_ab_i11', 'chk_abfahrt', 'cat_abf_innen', 'Dachluken und Fenster schließen und verriegeln', 10, 0),
  ('e_ab_i12', 'chk_abfahrt', 'cat_abf_innen', 'Raumteiler und schwere Gegenstände sichern', 11, 0),
  ('e_ab_i13', 'chk_abfahrt', 'cat_abf_innen', 'Gas abdrehen', 12, 0),
  ('e_ab_i14', 'chk_abfahrt', 'cat_abf_innen', 'Gas Absperrventile schließen', 13, 0),
  ('e_ab_i15', 'chk_abfahrt', 'cat_abf_innen', 'Kühlschrank umstellen', 14, 0),
  ('e_ab_a01', 'chk_abfahrt', 'cat_abf_aussen', 'Türen, Ladeklappen und Deichselkasten verschließen', 0, 0),
  ('e_ab_a02', 'chk_abfahrt', 'cat_abf_aussen', 'Stützen hochkurbeln', 1, 0),
  ('e_ab_a03', 'chk_abfahrt', 'cat_abf_aussen', 'Auffahrkeile einpacken', 2, 0),
  ('e_ab_a04', 'chk_abfahrt', 'cat_abf_aussen', 'Wohnanhänger ankuppeln', 3, 0),
  ('e_ab_a05', 'chk_abfahrt', 'cat_abf_aussen', 'Abreißseil anlegen', 4, 0),
  ('e_ab_a06', 'chk_abfahrt', 'cat_abf_aussen', 'Pkw-Kabel anschließen', 5, 0),
  ('e_ab_a07', 'chk_abfahrt', 'cat_abf_aussen', 'Handbremse am Wohnwagen lösen', 6, 0),
  ('e_ab_a08', 'chk_abfahrt', 'cat_abf_aussen', 'Stützrad hochfahren und sichern', 7, 0),
  ('e_ab_a09', 'chk_abfahrt', 'cat_abf_aussen', 'Mover abschwenken und Sicherung (innen und außen) trennen', 8, 0),
  ('e_ab_a10', 'chk_abfahrt', 'cat_abf_aussen', 'Fahrradträger einrasten', 9, 0),
  ('e_ab_a11', 'chk_abfahrt', 'cat_abf_aussen', 'Fahrräder sichern', 10, 0),
  ('e_ab_a12', 'chk_abfahrt', 'cat_abf_aussen', 'Stellplatz abschließend prüfen', 11, 0),
  ('e_ab_a13', 'chk_abfahrt', 'cat_abf_aussen', 'Stützlast prüfen', 12, 0),
  ('e_ab_a14', 'chk_abfahrt', 'cat_abf_aussen', 'Stromversorgung trennen', 13, 0),
  ('e_ab_a15', 'chk_abfahrt', 'cat_abf_aussen', 'Lichter kontrollieren', 14, 0),
  ('e_ab_au01', 'chk_abfahrt', 'cat_abf_auto', 'Spiegel anbringen', 0, 0),
  ('e_ein_e01', 'chk_einwintern', 'cat_ein_ent', 'Lebensmittel', 0, 0),
  ('e_ein_e02', 'chk_einwintern', 'cat_ein_ent', 'Flüssigkeiten', 1, 0),
  ('e_ein_e03', 'chk_einwintern', 'cat_ein_ent', 'Handtücher', 2, 0),
  ('e_ein_e04', 'chk_einwintern', 'cat_ein_ent', 'Küchenrolle', 3, 0),
  ('e_ein_e05', 'chk_einwintern', 'cat_ein_ent', 'Toilettenpapier', 4, 0),
  ('e_ein_p01', 'chk_einwintern', 'cat_ein_pflege', 'Außen reinigen', 0, 0),
  ('e_ein_p02', 'chk_einwintern', 'cat_ein_pflege', 'Küche reinigen', 1, 0),
  ('e_ein_p03', 'chk_einwintern', 'cat_ein_pflege', 'Bad reinigen', 2, 0),
  ('e_ein_p04', 'chk_einwintern', 'cat_ein_pflege', 'Toilette reinigen', 3, 0),
  ('e_ein_p05', 'chk_einwintern', 'cat_ein_pflege', 'Toilettenschieber schmieren', 4, 0),
  ('e_ein_p06', 'chk_einwintern', 'cat_ein_pflege', 'Alle Dichtungen (Fenster, Türen, Dachluken, Staufächer) reinigen und schmieren', 5, 0),
  ('e_ein_p07', 'chk_einwintern', 'cat_ein_pflege', 'Holzbesteck ölen', 6, 0),
  ('e_ein_p08', 'chk_einwintern', 'cat_ein_pflege', 'Markise Reinigen', 7, 0),
  ('e_ein_l01', 'chk_einwintern', 'cat_ein_lueft', 'Rollos öffnen', 0, 0),
  ('e_ein_l02', 'chk_einwintern', 'cat_ein_lueft', 'Elternbett hochstellen', 1, 0),
  ('e_ein_l03', 'chk_einwintern', 'cat_ein_lueft', 'Unteres Kinderbett halb schräg', 2, 0),
  ('e_ein_l04', 'chk_einwintern', 'cat_ein_lueft', 'Schränke öffnen inkl. Kühlschrank und Gefrierfach', 3, 0),
  ('e_ein_l05', 'chk_einwintern', 'cat_ein_lueft', 'Sitzpolster hochkant stellen', 4, 0),
  ('e_ein_l06', 'chk_einwintern', 'cat_ein_lueft', 'Toilettendeckel öffnen', 5, 0),
  ('e_ein_l07', 'chk_einwintern', 'cat_ein_lueft', 'Badtür öffnen', 6, 0),
  ('e_ein_s01', 'chk_einwintern', 'cat_ein_scharn', 'Scharniere und Schlösser fetten', 0, 0),
  ('e_ein_w01', 'chk_einwintern', 'cat_ein_wasser', 'Entkeimen', 0, 0),
  ('e_ein_w02', 'chk_einwintern', 'cat_ein_wasser', 'Freipusten (z.B. mit Luftballon)', 1, 0),
  ('e_ein_w03', 'chk_einwintern', 'cat_ein_wasser', 'Absperrventile öffnen', 2, 0),
  ('e_ein_w04', 'chk_einwintern', 'cat_ein_wasser', 'Wasserhähne auf mittlerer Stellung geöffnet lassen', 3, 0),
  ('e_ein_so01', 'chk_einwintern', 'cat_ein_sonst', 'Winterabdeckungen für Kühlschrank und Heizung montieren', 0, 0),
  ('e_ein_so02', 'chk_einwintern', 'cat_ein_sonst', 'Batterie ausbauen (zuhause lagern)', 1, 0),
  ('e_ein_so03', 'chk_einwintern', 'cat_ein_sonst', 'Gas Absperrventile schließen', 2, 0),
  ('e_ein_so04', 'chk_einwintern', 'cat_ein_sonst', 'Gasleitungen leeren', 3, 0),
  ('e_ein_so05', 'chk_einwintern', 'cat_ein_sonst', 'Reifendruck erhöhen (um ca. 0,5 Bar)', 4, 0),
  ('e_ein_so06', 'chk_einwintern', 'cat_ein_sonst', 'Handbremse und Stützrad fetten', 5, 0);
