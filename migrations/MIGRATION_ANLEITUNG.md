# Datenbank-Migrations-Anleitung

## Migration 0002: Transport und Mitreisenden-Verwaltung

Diese Migration erweitert das Datenbankschema um Funktionen für:
- Transport-Verwaltung (Wohnwagen/Auto) pro Packlisten-Eintrag
- Mitreisenden-spezifisches Abhaken (pauschal/alle/ausgewählte)
- Standard-Zuordnungen von Mitreisenden zu Ausrüstungsgegenständen

### Voraussetzungen

- Cloudflare Wrangler CLI installiert
- Zugriff auf die D1-Datenbank `camping-checkliste-db`

### Migration ausführen

1. **Navigieren Sie zum Projektverzeichnis:**
   ```bash
   cd /pfad/zu/camping-checkliste
   ```

2. **Migration auf die D1-Datenbank anwenden:**
   ```bash
   wrangler d1 execute camping-checkliste-db --file=migrations/0002_transport_mitreisenden.sql
   ```

3. **Erfolg überprüfen:**
   Nach erfolgreicher Ausführung sollten Sie eine Bestätigung sehen:
   ```
   🌀 Executing on camping-checkliste-db (XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX):
   🌀 To execute on your remote database, add a --remote flag to your wrangler command.
   ✅ Executed 0002_transport_mitreisenden.sql
   ```

4. **Migration auf die Remote-Datenbank anwenden (Produktion):**
   ```bash
   wrangler d1 execute camping-checkliste-db --remote --file=migrations/0002_transport_mitreisenden.sql
   ```

### Änderungen im Detail

#### 1. Transport-Feld in Packlisten-Einträgen
- **Tabelle:** `packlisten_eintraege`
- **Neues Feld:** `transport_id` (TEXT, optional)
- **Zweck:** Ermöglicht individuelle Festlegung des Transportmittels pro Packlisten-Eintrag

#### 2. Mitreisenden-Typ bei Ausrüstungsgegenständen
- **Tabelle:** `ausruestungsgegenstaende`
- **Neues Feld:** `mitreisenden_typ` (TEXT, NOT NULL, DEFAULT 'pauschal')
- **Mögliche Werte:**
  - `'pauschal'`: Wird einmal für den gesamten Urlaub abgehakt (z.B. Gasflasche)
  - `'alle'`: Jeder Mitreisende muss separat abhaken (z.B. Kleidung)
  - `'ausgewaehlte'`: Nur bestimmte Personen müssen abhaken (z.B. Kontaktlinsen)

#### 3. Standard-Mitreisenden-Zuordnungen
- **Neue Tabelle:** `ausruestungsgegenstaende_standard_mitreisende`
- **Zweck:** Speichert Standard-Zuordnungen für Gegenstände vom Typ 'ausgewaehlte'
- **Felder:**
  - `gegenstand_id`: Referenz auf Ausrüstungsgegenstand
  - `mitreisender_id`: Referenz auf Mitreisenden
  - `created_at`: Zeitstempel

#### 4. Gepackt-Status pro Mitreisenden
- **Tabelle:** `packlisten_eintrag_mitreisende`
- **Neues Feld:** `gepackt` (INTEGER, NOT NULL, DEFAULT 0)
- **Zweck:** Ermöglicht individuelles Abhaken pro Mitreisenden

### Rollback (falls nötig)

Falls die Migration rückgängig gemacht werden muss:

```sql
-- Entferne neue Felder und Tabellen
DROP TABLE IF EXISTS ausruestungsgegenstaende_standard_mitreisende;
ALTER TABLE packlisten_eintraege DROP COLUMN transport_id;
ALTER TABLE ausruestungsgegenstaende DROP COLUMN mitreisenden_typ;
ALTER TABLE packlisten_eintrag_mitreisende DROP COLUMN gepackt;
```

**Hinweis:** SQLite unterstützt `ALTER TABLE DROP COLUMN` erst ab Version 3.35.0. Falls Ihre Version älter ist, müssen Sie die Tabellen neu erstellen.

### Nächste Schritte

Nach erfolgreicher Migration können Sie die erweiterten Funktionen in der Anwendung nutzen:
1. Transport-Verwaltung in der Packliste
2. Mitreisenden-spezifisches Abhaken
3. Intelligente Filterung von bereits hinzugefügten Gegenständen
