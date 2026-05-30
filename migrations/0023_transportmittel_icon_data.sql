-- Icon-Daten für Transportmittel (mehrfach ausführbar)
-- Voraussetzung: Spalte icon existiert (Migration 0022)

-- Legacy-Schlüssel aus erster Icon-Version
UPDATE transportmittel SET icon = 'van' WHERE icon = 'truck';

UPDATE transportmittel
SET icon = 'caravan'
WHERE (icon IS NULL OR icon IN ('truck', 'bus', 'van'))
  AND (LOWER(name) LIKE '%wohnwagen%' OR LOWER(name) LIKE '%caravan%');

UPDATE transportmittel
SET icon = 'van'
WHERE (icon IS NULL OR icon IN ('truck', 'bus'))
  AND (LOWER(name) LIKE '%kastenwagen%' OR LOWER(name) LIKE '% van%' OR LOWER(name) = 'van');

UPDATE transportmittel
SET icon = 'bus'
WHERE (icon IS NULL OR icon IN ('truck'))
  AND LOWER(name) LIKE '%wohnmobil%';

UPDATE transportmittel
SET icon = 'car'
WHERE (icon IS NULL OR icon IN ('truck', 'bus'))
  AND (LOWER(name) LIKE '%auto%' OR LOWER(name) LIKE '%pkw%');

UPDATE transportmittel
SET icon = 'container'
WHERE (icon IS NULL OR icon IN ('truck', 'bus'))
  AND (LOWER(name) LIKE '%anhänger%' OR LOWER(name) LIKE '%anhaenger%' OR LOWER(name) LIKE '%trailer%');

UPDATE transportmittel
SET icon = 'package'
WHERE (icon IS NULL OR icon IN ('truck', 'bus'))
  AND LOWER(name) LIKE '%dachbox%';

UPDATE transportmittel
SET icon = 'box'
WHERE (icon IS NULL OR icon IN ('truck', 'bus'))
  AND LOWER(name) LIKE '%heckbox%';

UPDATE transportmittel
SET icon = 'van'
WHERE icon IS NULL;
