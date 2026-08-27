-- Migration 0053: Kennzeichen „ein Tag länger gebucht“ + gebuchtes Abreisedatum
-- Local:  wrangler d1 execute camping-db --local --file=./migrations/0053_buchung_abreise_extra_tag.sql
-- Remote: wrangler d1 execute camping-db --remote --file=./migrations/0053_buchung_abreise_extra_tag.sql

ALTER TABLE urlaub_campingplaetze ADD COLUMN buchung_abreise_extra_tag INTEGER NOT NULL DEFAULT 0;
ALTER TABLE urlaub_campingplaetze ADD COLUMN buchung_end_datum TEXT;
