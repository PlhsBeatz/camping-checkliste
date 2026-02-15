# Datenbank-Migrationen und Schema

## Referenz für den aktuellen Stand

**Die Migrations-Anleitungen in diesem Ordner können aus früheren Iterationen stammen und veraltet sein.**

### Aktuelle Referenzdateien (im Projektroot)

- **[schema.sql](../schema.sql)** – Vollständiges aktuelles Datenbankschema (CREATE TABLE, Indizes, Trigger). Entspricht dem Produktionsstand.
- **[data.sql](../data.sql)** – Beispieldaten-Export (z.B. aus Cloudflare D1). Enthält u.a.:
  - Hauptkategorien, Kategorien
  - Transportmittel (Wohnwagen, Auto)
  - Mitreisende, Urlaube, Tags
  - Basis-Ausrüstung, Packlisten
  
  *Hinweis:* Transportmittel und weitere Grundeinstellungen sind derzeit nicht über die UI konfigurierbar und müssen ggf. manuell oder über data.sql übernommen werden.

### Frische Datenbank einrichten

**Variante A – Vollständiges Schema (empfohlen für neue Umgebung)**

1. `schema.sql` auf die D1-Datenbank anwenden (enthält bereits alle Tabellen inkl. Transport/Mitreisende/Tags).
2. Optional: Basis-Daten aus `data.sql` importieren (z.B. Transportmittel, Kategorien).

**Variante B – Inkrementell (Migrationen in Reihenfolge)**

1. `0001_initial.sql`
2. `0002_transport_mitreisenden_v2.sql` (für D1; `0002_transport_mitreisenden.sql` ist deprecated)
3. `add_tags_system.sql`

### Wichtige Hinweise für zukünftige Ausbaustufen

- **Fest Installiert:** Einträge mit Status „Fest Installiert“ sollen in der Packlisten-Anzeige ausgeblendet werden (Usability – sie sind fest verbaut, immer dabei). Bei der **Gewichtsberechnung pro Transportmittel** müssen sie jedoch berücksichtigt werden. *Noch nicht umgesetzt.*
- **Ausgemustert:** Wird in Auswahl-Dialogen (Generator, Hinzufügen) ausgeblendet. ✓
