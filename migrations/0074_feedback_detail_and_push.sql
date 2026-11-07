-- Migration 0074: Feedback-Detailtext + Push bei Statusänderungen
-- Lokal:  npx wrangler d1 migrations apply camping-db --local
-- Remote: npx wrangler d1 migrations apply camping-db --remote

ALTER TABLE feedback_submissions ADD COLUMN description TEXT;
ALTER TABLE feedback_submissions ADD COLUMN known_status TEXT;

-- Push für eigene Feedback-Meldungen: aus (0), Modus fertigstellung (done)
ALTER TABLE users ADD COLUMN push_feedback INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN push_feedback_mode TEXT NOT NULL DEFAULT 'done';
