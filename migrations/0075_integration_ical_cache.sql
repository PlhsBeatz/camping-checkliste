-- Last-good iCal-Feeds für Urlaubs-Kalender-Abos (vier Varianten parallel).
CREATE TABLE IF NOT EXISTS integration_ical_cache (
  feed_key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
