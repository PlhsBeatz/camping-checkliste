-- Migration 0058: Lebensdauer der Ausrüstung (Anschaffung, Ausmustern, Nachfolger)
-- Anwenden: npx wrangler d1 migrations apply camping-db --local
-- Produktion: npx wrangler d1 migrations apply camping-db --remote

ALTER TABLE ausruestungsgegenstaende ADD COLUMN anschaffungsdatum TEXT;
ALTER TABLE ausruestungsgegenstaende ADD COLUMN ausgemustert_am TEXT;
ALTER TABLE ausruestungsgegenstaende ADD COLUMN ersetzt_durch_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ausruestungsgegenstaende_anschaffungsdatum
    ON ausruestungsgegenstaende(anschaffungsdatum);
CREATE INDEX IF NOT EXISTS idx_ausruestungsgegenstaende_ausgemustert_am
    ON ausruestungsgegenstaende(ausgemustert_am);
CREATE INDEX IF NOT EXISTS idx_ausruestungsgegenstaende_ersetzt_durch
    ON ausruestungsgegenstaende(ersetzt_durch_id);
