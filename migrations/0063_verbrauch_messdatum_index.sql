-- Index für Zeitfenster-Filter (Reichweite / Übersicht letzte N Jahre)
CREATE INDEX IF NOT EXISTS idx_verbrauch_typ_messdatum_ende
  ON verbrauch_messungen(typ, messdatum_ende);
