-- Bezugstag für Saisonstart (wann Fälligkeit gesetzt/geändert wurde)

ALTER TABLE optimierungen ADD COLUMN faelligkeit_bezug_am TEXT;

-- Bestehende Saisonstart-Einträge: Bezug = heute, damit Recalc konsistent bleibt
UPDATE optimierungen
SET faelligkeit_bezug_am = date('now')
WHERE faelligkeit_modus = 'saisonstart'
  AND (faelligkeit_bezug_am IS NULL OR faelligkeit_bezug_am = '');
