-- Optimierungen: Fälligkeit als Modus + berechnetes Datum (für Reminder)

ALTER TABLE optimierungen ADD COLUMN faelligkeit_modus TEXT;
ALTER TABLE optimierungen ADD COLUMN faellig_am TEXT;

-- Grobe Übernahme alter Zeitfelder
UPDATE optimierungen SET faelligkeit_modus = 'naechster_urlaub'
WHERE zeitfenster IN ('waehrend_urlaub');

UPDATE optimierungen SET faelligkeit_modus = 'saisonstart'
WHERE zeitfenster IN ('vor_saison', 'nach_saison', 'winter');

UPDATE optimierungen SET faelligkeit_modus = 'irgendwann'
WHERE zeitfenster = 'jederzeit';
