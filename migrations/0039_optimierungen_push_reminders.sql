-- Push-Präferenz: Optimierungs-Fälligkeit (Default aktiv)
ALTER TABLE users ADD COLUMN push_optimierung_faelligkeit INTEGER NOT NULL DEFAULT 1;

-- Deduplizierung der Erinnerungen (4 bzw. 2 Wochen vor faellig_am)
ALTER TABLE optimierungen ADD COLUMN push_reminder_4w_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE optimierungen ADD COLUMN push_reminder_2w_sent INTEGER NOT NULL DEFAULT 0;
