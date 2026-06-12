-- Schritt 3/3: users + einladungen auf neue Rollen
-- Nur ausführen, wenn noch role IN ('kind','gast') vorkommt — sonst überspringen.
-- Empfohlen: npm run db:migrate:0026

DROP TABLE IF EXISTS users_new;

CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('system_admin', 'admin', 'standard')),
    mitreisender_id TEXT UNIQUE,
    password_reset_token TEXT,
    password_reset_expires TEXT,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    heimat_adresse TEXT,
    heimat_lat REAL,
    heimat_lng REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE SET NULL
);

INSERT INTO users_new (
    id, email, password_hash, role, mitreisender_id,
    password_reset_token, password_reset_expires, must_change_password,
    heimat_adresse, heimat_lat, heimat_lng, created_at, updated_at
)
SELECT
    id, email, password_hash,
    CASE
        WHEN role IN ('kind', 'gast') THEN 'standard'
        WHEN role IN ('admin', 'system_admin', 'standard') THEN role
        ELSE 'standard'
    END,
    mitreisender_id,
    password_reset_token, password_reset_expires,
    COALESCE(must_change_password, 0),
    heimat_adresse, heimat_lat, heimat_lng,
    created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_mitreisender_id ON users(mitreisender_id);

DROP TABLE IF EXISTS einladungen_new;

CREATE TABLE einladungen_new (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    mitreisender_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'standard')),
    erstellt_von TEXT,
    eingeladen_am TEXT NOT NULL DEFAULT (datetime('now')),
    angenommen_am TEXT,
    ablauf TEXT,
    FOREIGN KEY (mitreisender_id) REFERENCES mitreisende(id) ON DELETE CASCADE,
    FOREIGN KEY (erstellt_von) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO einladungen_new (id, token, mitreisender_id, role, erstellt_von, eingeladen_am, angenommen_am, ablauf)
SELECT
    id, token, mitreisender_id,
    CASE WHEN role = 'admin' THEN 'admin' ELSE 'standard' END,
    erstellt_von, eingeladen_am, angenommen_am, ablauf
FROM einladungen;

DROP TABLE einladungen;
ALTER TABLE einladungen_new RENAME TO einladungen;

CREATE INDEX IF NOT EXISTS idx_einladungen_token ON einladungen(token);
CREATE INDEX IF NOT EXISTS idx_einladungen_mitreisender_id ON einladungen(mitreisender_id);
