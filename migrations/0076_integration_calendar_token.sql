-- Kalender-spezifischer Integrations-Token (automatisch, nur für iCal).
ALTER TABLE integration_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'api';

CREATE TABLE IF NOT EXISTS integration_calendar_token (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token_id TEXT NOT NULL,
  token_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (token_id) REFERENCES integration_tokens(id)
);
