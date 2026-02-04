# Tag-System für automatische Packlisten-Generierung

## 📋 Übersicht

Das Tag-System ermöglicht die flexible Kategorisierung von Ausrüstungsgegenständen und die automatische Generierung von Packlisten basierend auf Tags und Standard-Markierungen.

## 🎯 Hauptfunktionen

### 1. Tag-Verwaltung
- Erstellen, Bearbeiten und Löschen von Tags
- Farbzuordnung für visuelle Unterscheidung
- Icon-Unterstützung (Emojis)
- Beschreibung für jeden Tag

### 2. Standard-Gegenstände
- Markierung von Gegenständen als "Standard"
- Automatische Einbeziehung bei jeder Packlisten-Generierung
- Unabhängig von Tags

### 3. Tag-Zuordnung
- Mehrfach-Zuordnung von Tags zu Gegenständen
- Flexible Kombination möglich
- Visuelle Darstellung in der Ausrüstungsliste

### 4. Automatische Generierung
- Auswahl von Tags für spezifische Urlaube
- Vorschau der zu generierenden Gegenstände
- Batch-Hinzufügen zur Packliste

## 🗄️ Datenbank-Schema

### Neue Tabellen

#### `tags`
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  titel TEXT NOT NULL,
  farbe TEXT,
  icon TEXT,
  beschreibung TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### `ausruestungsgegenstaende_tags`
```sql
CREATE TABLE ausruestungsgegenstaende_tags (
  gegenstand_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (gegenstand_id, tag_id),
  FOREIGN KEY (gegenstand_id) REFERENCES ausruestungsgegenstaende(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

### Erweiterte Spalten

#### `ausruestungsgegenstaende`
```sql
ALTER TABLE ausruestungsgegenstaende 
ADD COLUMN is_standard INTEGER DEFAULT 0;
```

## 📁 Dateistruktur

### Backend

#### Datenbank-Funktionen (`src/lib/db.ts`)
- `getTags()` - Alle Tags abrufen
- `createTag()` - Neuen Tag erstellen
- `updateTag()` - Tag aktualisieren
- `deleteTag()` - Tag löschen
- `getTagsForEquipment()` - Tags für Gegenstand abrufen
- `setTagsForEquipment()` - Tags für Gegenstand setzen
- `getEquipmentByTags()` - Gegenstände nach Tags filtern

#### API-Routen
- `src/app/api/tags/route.ts` - CRUD für Tags
- `src/app/api/equipment-items/route.ts` - CRUD für Ausrüstung (mit Tags)
- `src/app/api/equipment-by-tags/route.ts` - Filtern nach Tags

### Frontend

#### Komponenten
- `src/components/tag-manager.tsx` - Tag-Verwaltung
- `src/components/packing-list-generator.tsx` - Automatischer Generator
- `src/components/ui/textarea.tsx` - UI-Komponente

#### Integration
- `src/app/page.tsx` - Hauptseite mit allen Integrationen

### Datenbank
- `migrations/add_tags_system.sql` - Migrations-Datei

## 🚀 Installation & Setup

### 1. Datenbank-Migration ausführen

```bash
# Lokal mit Wrangler
wrangler d1 execute camping-checklist --file=migrations/add_tags_system.sql

# Oder über Cloudflare Dashboard
# SQL-Datei im Dashboard hochladen und ausführen
```

### 2. Code deployen

```bash
git add .
git commit -m "feat: add tag system for automatic packing list generation"
git push origin main
```

### 3. Beispiel-Tags erstellen (optional)

Die Migration enthält bereits 6 Beispiel-Tags:
- ☀️ Sommer
- ❄️ Winter
- 🏖️ Strand
- ⛰️ Berge
- 🔥 Feuerküche
- 🌊 Wassersport

## 📖 Benutzerhandbuch

### Tags erstellen

1. **Tab "Tags" öffnen**
2. **"Neuer Tag" klicken**
3. **Titel eingeben** (z.B. "Sommer")
4. **Farbe wählen** (aus Voreinstellungen oder eigene)
5. **Icon hinzufügen** (optional, z.B. ☀️)
6. **Beschreibung** (optional)
7. **"Erstellen" klicken**

### Ausrüstung taggen

1. **Tab "Ausrüstung" öffnen**
2. **Gegenstand bearbeiten** (Stift-Icon)
3. **Scroll nach unten zu "Tags für Packlisten-Generierung"**
4. **Tags auswählen** (Mehrfachauswahl möglich)
5. **Optional: "Als Standard markieren" aktivieren**
6. **"Speichern" klicken**

### Packliste automatisch generieren

1. **Tab "Packliste" öffnen**
2. **Urlaub auswählen**
3. **"Automatisch generieren" klicken**
4. **Standard-Gegenstände aktivieren** (empfohlen)
5. **Tags auswählen** (z.B. Sommer + Strand)
6. **Vorschau prüfen**
7. **"X Gegenstände hinzufügen" klicken**

## 🎨 UI-Features

### Tag-Darstellung

**In der Tag-Verwaltung:**
- Farbiger Rand links
- Icon oder Tag-Symbol
- Titel und Beschreibung
- Bearbeiten/Löschen Buttons

**Im Equipment-Dialog:**
- Checkbox-Liste
- Farbpunkt + Icon + Titel
- Mehrfachauswahl möglich

**Im Generator:**
- Checkbox-Liste mit Farbe und Icon
- Gruppierte Vorschau nach Hauptkategorien
- Zähler für ausgewählte Gegenstände

### Standard-Markierung

**Visuell:**
- ⭐ Stern-Icon
- Gelber Hintergrund im Equipment-Dialog
- Badge in Listen

**Funktional:**
- Immer in Generator-Vorschau
- Unabhängig von Tag-Auswahl
- Toggle im Equipment-Dialog

## 🔧 Technische Details

### Tag-Filterung

**Logik in `getEquipmentByTags()`:**
```typescript
WHERE (
  a.is_standard = 1  // Standard-Gegenstände
  OR
  a.id IN (          // ODER Gegenstände mit ausgewählten Tags
    SELECT gegenstand_id 
    FROM ausruestungsgegenstaende_tags 
    WHERE tag_id IN (tagIds)
  )
)
```

### Batch-Generierung

**Workflow:**
1. Tags auswählen → Equipment filtern
2. Für jeden Gegenstand:
   - Standard-Anzahl verwenden
   - Mitreisende basierend auf Typ zuordnen
   - Transport-Zuordnung übernehmen
3. API-Calls für alle Gegenstände
4. Packliste aktualisieren

### Performance-Optimierungen

**Indizes:**
```sql
CREATE INDEX idx_tags_titel ON tags(titel);
CREATE INDEX idx_ausruestungsgegenstaende_tags_gegenstand 
  ON ausruestungsgegenstaende_tags(gegenstand_id);
CREATE INDEX idx_ausruestungsgegenstaende_tags_tag 
  ON ausruestungsgegenstaende_tags(tag_id);
CREATE INDEX idx_ausruestungsgegenstaende_is_standard 
  ON ausruestungsgegenstaende(is_standard);
```

## 📊 Beispiel-Workflows

### Workflow 1: Sommer-Strandurlaub

**Setup:**
1. Tags erstellen: "Sommer", "Strand", "Wassersport"
2. Ausrüstung taggen:
   - Sonnencreme → Sommer, Strand
   - Badehose → Sommer, Strand, Wassersport
   - Schnorchel → Strand, Wassersport
   - Erste-Hilfe-Set → Standard (kein Tag)

**Generierung:**
1. Urlaub "Mallorca 2026" erstellen
2. Generator öffnen
3. Tags auswählen: Sommer ✓, Strand ✓, Wassersport ✓
4. Standard einschließen ✓
5. Vorschau: 4 Gegenstände (inkl. Erste-Hilfe-Set)
6. Generieren → Alle zur Packliste hinzugefügt

### Workflow 2: Winter-Bergtour

**Setup:**
1. Tags erstellen: "Winter", "Berge", "Wandern"
2. Ausrüstung taggen:
   - Winterjacke → Winter, Berge
   - Wanderschuhe → Berge, Wandern
   - Thermoskanne → Winter, Wandern
   - Erste-Hilfe-Set → Standard

**Generierung:**
1. Urlaub "Alpen 2026" erstellen
2. Generator öffnen
3. Tags: Winter ✓, Berge ✓, Wandern ✓
4. Generieren → 4 Gegenstände hinzugefügt

### Workflow 3: Camping mit Feuerküche

**Setup:**
1. Tags: "Feuerküche", "Grillen", "Sommer"
2. Ausrüstung:
   - Feuerschale → Feuerküche
   - Grillrost → Feuerküche, Grillen
   - Grillzange → Grillen
   - Anzünder → Feuerküche, Grillen

**Generierung:**
1. Tags: Feuerküche ✓, Grillen ✓
2. → 4 Gegenstände + Standard-Items

## 🐛 Troubleshooting

### Problem: Tags werden nicht angezeigt

**Lösung:**
1. Datenbank-Migration ausgeführt?
2. Browser-Cache leeren
3. API-Route testen: `GET /api/tags`

### Problem: Generierung funktioniert nicht

**Lösung:**
1. Mindestens 1 Tag oder Standard aktiviert?
2. Urlaub ausgewählt?
3. Browser-Konsole auf Fehler prüfen

### Problem: Tags werden nicht gespeichert

**Lösung:**
1. Equipment-Items API-Route deployed?
2. `is_standard` und `tags` Felder im Request?
3. Datenbank-Funktion `setTagsForEquipment()` vorhanden?

## 🔮 Zukünftige Erweiterungen

### Geplante Features

1. **Tag-Kategorien**
   - Jahreszeit, Aktivität, Reiseziel
   - Strukturierte Gruppierung

2. **Smart-Vorschläge**
   - Automatische Tag-Erkennung aus Urlaubsdaten
   - Datum → Jahreszeit
   - Reiseziel → Klima-Tags

3. **Packlisten-Vorlagen**
   - Speichern von Tag-Kombinationen
   - "Sommer am Meer" als Vorlage
   - Wiederverwenden mit 1 Klick

4. **Lern-Algorithmus**
   - Häufig zusammen gepackte Gegenstände
   - Personalisierte Vorschläge
   - Vergessene Gegenstände erkennen

5. **Sharing**
   - Tags zwischen Nutzern teilen
   - Community-Vorlagen
   - Bewertungen

## 📈 Metriken & Analytics

### Tracking-Möglichkeiten

- Häufigste Tag-Kombinationen
- Beliebteste Tags
- Durchschnittliche Gegenstände pro Packliste
- Standard-Gegenstände Nutzung

### Optimierungspotenzial

- Ungenutzte Tags identifizieren
- Überlappende Tags zusammenführen
- Fehlende Tags vorschlagen

## 🤝 Beitragen

### Code-Stil

- TypeScript strict mode
- German variable names (konsistent mit DB)
- Kommentare auf Deutsch
- UI-Texte auf Deutsch

### Testing

- Manuelle Tests vor Deployment
- Edge Cases prüfen:
  - Keine Tags vorhanden
  - Alle Tags ausgewählt
  - Keine Standard-Gegenstände
  - Leere Packliste

## 📞 Support

Bei Fragen oder Problemen:
1. Dokumentation prüfen
2. Browser-Konsole auf Fehler prüfen
3. Datenbank-Schema validieren
4. API-Routen testen

## 🎉 Zusammenfassung

Das Tag-System bietet:
- ✅ Flexible Kategorisierung
- ✅ Automatische Generierung
- ✅ Standard-Gegenstände
- ✅ Mehrfach-Zuordnung
- ✅ Visuelle Darstellung
- ✅ Einfache Bedienung
- ✅ Erweiterbar

**Viel Erfolg beim Packen! 🎒**
