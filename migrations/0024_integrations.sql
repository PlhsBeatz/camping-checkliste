-- Migration: Smart-Home / Integrations-API (Tokens, Webhooks, Zustand, Delivery-Log)
-- Folgt auf 0023_transportmittel_icon_data.sql

CREATE TABLE IF NOT EXISTS integration_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_prefix TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT,
    revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_hash ON integration_tokens(token_hash);

CREATE TABLE IF NOT EXISTS integration_webhooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    signing_secret TEXT NOT NULL,
    enabled_events TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS integration_vacation_state (
    vacation_id TEXT PRIMARY KEY,
    percent INTEGER NOT NULL DEFAULT 0,
    complete INTEGER NOT NULL DEFAULT 0,
    phase TEXT NOT NULL DEFAULT 'planning',
    last_progress_event_percent INTEGER,
    departure_approaching_sent INTEGER NOT NULL DEFAULT 0,
    departure_day_sent INTEGER NOT NULL DEFAULT 0,
    trip_started_sent INTEGER NOT NULL DEFAULT 0,
    trip_ended_sent INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vacation_id) REFERENCES urlaube(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS integration_webhook_deliveries (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_id TEXT NOT NULL,
    vacation_id TEXT,
    http_status INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (webhook_id) REFERENCES integration_webhooks(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_integration_webhook_deliveries_webhook ON integration_webhook_deliveries(webhook_id);
