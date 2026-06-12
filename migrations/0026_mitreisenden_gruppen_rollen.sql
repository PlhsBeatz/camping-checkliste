-- Migration: Reisegruppen, Personentyp, Nutzerrollen system_admin|admin|standard
-- Ausführen (empfohlen): npm run db:migrate:0026
-- Oder manuell nacheinander:
--   1. 0026_mitreisende_spalten.sql   (überspringen wenn gruppe_id schon existiert)
--   2. diese Datei
--   3. 0026_users_einladungen_rollen.sql (überspringen wenn users.role bereits system_admin|admin|standard)

-- Reisegruppen
CREATE TABLE IF NOT EXISTS mitreisenden_gruppe (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    ist_standard_familie INTEGER NOT NULL DEFAULT 0,
    urlaub_standard_mitnehmen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO mitreisenden_gruppe (id, name, sort_order, ist_standard_familie, urlaub_standard_mitnehmen)
VALUES ('grp-familie', 'Familie', 0, 1, 1);

INSERT OR IGNORE INTO mitreisenden_gruppe (id, name, sort_order, ist_standard_familie, urlaub_standard_mitnehmen)
VALUES ('grp-weitere', 'Weitere', 1, 0, 0);

-- Datenmigration Mitreisende (idempotent)
UPDATE mitreisende SET gruppe_id = 'grp-familie' WHERE is_default_member = 1 AND (gruppe_id IS NULL OR gruppe_id = '');
UPDATE mitreisende SET gruppe_id = 'grp-weitere' WHERE is_default_member = 0 AND (gruppe_id IS NULL OR gruppe_id = '');
UPDATE mitreisende SET gruppe_id = 'grp-familie' WHERE gruppe_id IS NULL OR gruppe_id = '';

UPDATE mitreisende SET personentyp = 'kind'
WHERE personentyp IS NULL OR personentyp = '' OR personentyp = 'erwachsen'
AND id IN (
    SELECT m.id FROM mitreisende m
    INNER JOIN users u ON m.user_id = u.id
    WHERE u.role = 'kind'
);

UPDATE mitreisende SET personentyp = 'erwachsen'
WHERE personentyp IS NULL OR personentyp = '';
