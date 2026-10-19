-- Feedback-Meldungen aus der App (Verknüpfung zu GitHub Issues)
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  github_issue_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'enhancement')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_id
  ON feedback_submissions (user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at
  ON feedback_submissions (created_at);
