-- Migration: Ausstehende Buchungs-Imports und E-Mail-Verknüpfungen pro Aufenthalt
-- Folgt auf 0049_urlaub_campingplaetze_buchung.sql

CREATE TABLE IF NOT EXISTS booking_import_pending (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    quelle TEXT NOT NULL,
    betreff TEXT,
    absender TEXT,
    empfangen_am TEXT NOT NULL DEFAULT (datetime('now')),
    inhalt_text TEXT,
    message_id TEXT,
    parsed_fields_json TEXT,
    vorgeschlagener_urlaub_id TEXT,
    r2_object_key TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vorgeschlagener_urlaub_id) REFERENCES urlaube(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_booking_import_pending_status ON booking_import_pending(status);

CREATE TABLE IF NOT EXISTS urlaub_campingplatz_emails (
    id TEXT PRIMARY KEY,
    stay_id TEXT NOT NULL,
    email_typ TEXT NOT NULL DEFAULT 'sonstiges',
    betreff TEXT,
    absender TEXT,
    empfangen_am TEXT,
    gmail_suchlink TEXT,
    inhalt_text TEXT,
    r2_object_key TEXT,
    import_pending_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (stay_id) REFERENCES urlaub_campingplaetze(id) ON DELETE CASCADE,
    FOREIGN KEY (import_pending_id) REFERENCES booking_import_pending(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_urlaub_campingplatz_emails_stay ON urlaub_campingplatz_emails(stay_id);
