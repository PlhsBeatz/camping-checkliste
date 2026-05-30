-- Icon-Schlüssel für Transportmittel (Packliste: kompakte Anzeige)
ALTER TABLE transportmittel ADD COLUMN icon TEXT;

UPDATE transportmittel
SET icon = 'caravan'
WHERE LOWER(name) LIKE '%wohnwagen%'
   OR LOWER(name) LIKE '%caravan%';

UPDATE transportmittel
SET icon = 'car'
WHERE icon IS NULL
  AND (LOWER(name) LIKE '%auto%' OR LOWER(name) LIKE '%pkw%');

UPDATE transportmittel
SET icon = 'truck'
WHERE icon IS NULL;
