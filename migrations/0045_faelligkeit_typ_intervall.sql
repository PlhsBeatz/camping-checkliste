-- Migration 0045: historie_mit_intervall → intervall
-- Ausführen: wrangler d1 execute camping-db --local --file=./migrations/0045_faelligkeit_typ_intervall.sql
-- Remote:   wrangler d1 execute camping-db --remote --file=./migrations/0045_faelligkeit_typ_intervall.sql

UPDATE faelligkeiten SET typ = 'intervall' WHERE typ = 'historie_mit_intervall';
