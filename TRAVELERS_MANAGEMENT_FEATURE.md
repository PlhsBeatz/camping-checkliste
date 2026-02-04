# Zentrale Mitreisenden-Verwaltung

## Übersicht

Die zentrale Mitreisenden-Verwaltung ermöglicht es Benutzern, alle Mitreisenden unabhängig von Urlauben zu verwalten. Standard-Mitreisende werden automatisch bei neuen Urlauben zugeordnet, was den Komfort erhöht und gleichzeitig Flexibilität bewahrt.

## Hauptfunktionen

### ⭐ Standard-Mitreisende
- Mitreisende können als "Standard" markiert werden
- Standard-Mitreisende werden **automatisch** bei neuen Urlauben zugeordnet
- Visuelle Kennzeichnung mit Stern-Icon (⭐)
- Separate Anzeige in gelb hervorgehobener Sektion

### 👥 Zentrale Verwaltung
- Unabhängige Verwaltung aller Mitreisenden
- Nicht mehr nur über Urlaubs-Dialog zugänglich
- Eigener Tab "Mitreisende" in der Hauptnavigation
- Vollständige CRUD-Operationen

### 🔮 Zukunftssicher
- **User-ID Feld** für zukünftige Login-Funktion
- Vorbereitung für Benutzer-Authentifizierung
- Zuordnung von Mitreisenden zu Benutzerkonten

## Implementierte Änderungen

### Backend (Datenbank)

**Datei:** `src/lib/db.ts`

#### Neue Funktion
```typescript
getDefaultMitreisende(db: D1Database): Promise<Mitreisender[]>
```
Ruft alle Mitreisenden mit `is_default_member = true` ab.

#### Verbesserte Funktion
```typescript
updateMitreisender(db, id, name, userId?, isDefaultMember?)
```
- Korrekte Behandlung des optionalen `isDefaultMember` Parameters
- Aktualisiert nur die Felder, die übergeben werden

### Frontend (UI-Komponente)

**Datei:** `src/components/travelers-manager.tsx`

Eine vollständig neue Komponente mit:

#### Übersichts-Statistiken
- **Gesamt:** Anzahl aller Mitreisenden
- **Standard:** Anzahl der Standard-Mitreisenden (gelb hervorgehoben)
- **Weitere:** Anzahl der nicht-Standard Mitreisenden

#### Zwei Sektionen
1. **Standard-Mitreisende** (gelb hervorgehoben)
   - Stern-Icon ⭐ zur visuellen Kennzeichnung
   - Gelber Hintergrund für bessere Sichtbarkeit
   - Hinweis: "Werden automatisch bei neuen Urlauben ausgewählt"

2. **Weitere Mitreisende**
   - Normale Darstellung
   - Können manuell zu Urlauben hinzugefügt werden

#### CRUD-Operationen
- ✅ **Erstellen:** Name, User-ID (optional), Standard-Status
- ✅ **Bearbeiten:** Alle Felder änderbar
- ✅ **Löschen:** Mit Bestätigungsdialog und Warnung
- ✅ **Anzeigen:** Gruppiert nach Standard/Weitere

#### Formular-Felder
- **Name** (Pflichtfeld): Text-Input
- **User-ID** (Optional): Text-Input mit Hinweis für zukünftige Login-Funktion
- **Als Standard markieren:** Checkbox mit Stern-Icon

### Frontend (Integration)

**Datei:** `src/app/page.tsx`

#### Neue Imports
```typescript
import { TravelersManager } from '@/components/travelers-manager'
import { UserCircle } from 'lucide-react'
```

#### Neuer Tab
- **Position:** Zwischen "Kategorien" und "Urlaube"
- **Icon:** UserCircle
- **Label:** "Mitreisende"
- **TabsList:** Erweitert auf `grid-cols-5`

#### Auto-Zuordnung bei Urlaubs-Erstellung
**Funktion:** `handleCreateVacation`

```typescript
// Nach erfolgreicher Urlaubs-Erstellung
const defaultTravelers = allMitreisende.filter(m => m.is_default_member)

if (defaultTravelers.length > 0) {
  const defaultIds = defaultTravelers.map(m => m.id)
  await fetch('/api/vacations/mitreisende', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vacationId: newVacationId,
      mitreisendeIds: defaultIds
    })
  })
}
```

**Ablauf:**
1. Neuer Urlaub wird erstellt
2. System filtert alle Standard-Mitreisenden (`is_default_member = true`)
3. Standard-Mitreisende werden automatisch dem neuen Urlaub zugeordnet
4. Keine manuelle Auswahl erforderlich

## Benutzeroberfläche

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Mitreisende verwalten                [+ Neuer Mitreisender] │
│ Zentrale Verwaltung aller Mitreisenden...                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ┌─ Statistiken ──────────────────────────────────────┐ │
│ │  Gesamt: 5    Standard: 2    Weitere: 3           │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ ⭐ Standard-Mitreisende ──────────────────────────┐ │
│ │  Diese werden automatisch bei neuen Urlauben...   │ │
│ │                                                     │ │
│ │  👤 Melli                                          │ │
│ │     User-ID: melli@example.com                     │ │
│ │     [✏️] [🗑️]                                       │ │
│ │                                                     │ │
│ │  👤 Tom                                            │ │
│ │     [✏️] [🗑️]                                       │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─ Weitere Mitreisende ──────────────────────────────┐ │
│ │  Diese können manuell zu Urlauben hinzugefügt...  │ │
│ │                                                     │ │
│ │  👤 Luisa                                          │ │
│ │     [✏️] [🗑️]                                       │ │
│ │                                                     │ │
│ │  👤 Max                                            │ │
│ │     [✏️] [🗑️]                                       │ │
│ └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Dialog: Mitreisenden erstellen/bearbeiten

```
┌─────────────────────────────────────┐
│ Neuer Mitreisender                  │
├─────────────────────────────────────┤
│                                     │
│ Name *                              │
│ [z.B. Max Mustermann            ]  │
│                                     │
│ User-ID (optional)                  │
│ [Für zukünftige Login-Funktion  ]  │
│ ℹ️ Dieses Feld wird für die         │
│   zukünftige Benutzer-              │
│   Authentifizierung verwendet       │
│                                     │
│ ☐ ⭐ Als Standard markieren         │
│   Standard-Mitreisende werden       │
│   automatisch bei neuen Urlauben    │
│   ausgewählt                        │
│                                     │
│ [     Erstellen     ]               │
└─────────────────────────────────────┘
```

## Workflow

### Szenario 1: Standard-Mitreisende einrichten

1. **Navigieren Sie zum "Mitreisende"-Tab**
2. **Klicken Sie auf "+ Neuer Mitreisender"**
3. **Geben Sie den Namen ein** (z.B. "Melli")
4. **Optional:** Geben Sie eine User-ID ein (z.B. "melli@example.com")
5. **Aktivieren Sie "Als Standard markieren"** ⭐
6. **Klicken Sie auf "Erstellen"**
7. Der Mitreisende erscheint in der **Standard-Sektion** (gelb hervorgehoben)

### Szenario 2: Neuen Urlaub erstellen

1. **Navigieren Sie zum "Urlaube"-Tab**
2. **Klicken Sie auf "+ Neuer Urlaub"**
3. **Füllen Sie die Urlaubs-Details aus**
4. **Klicken Sie auf "Urlaub erstellen"**
5. **✨ Automatisch:** Alle Standard-Mitreisenden werden dem Urlaub zugeordnet
6. **Im Urlaubs-Dialog:** Standard-Mitreisende sind bereits ausgewählt
7. **Optional:** Weitere Mitreisende manuell hinzufügen

### Szenario 3: Flexiblen Mitreisenden hinzufügen

1. **Navigieren Sie zum "Mitreisende"-Tab**
2. **Klicken Sie auf "+ Neuer Mitreisender"**
3. **Geben Sie den Namen ein** (z.B. "Gast-Freund")
4. **Lassen Sie "Als Standard markieren" DEAKTIVIERT**
5. **Klicken Sie auf "Erstellen"**
6. Der Mitreisende erscheint in der **"Weitere Mitreisende"** Sektion
7. **Bei Bedarf:** Manuell zu spezifischen Urlauben hinzufügen

## Vorteile

### ✅ Komfort
- Standard-Mitreisende müssen nicht bei jedem Urlaub neu ausgewählt werden
- Automatische Zuordnung spart Zeit
- Einmal einrichten, immer verfügbar

### ✅ Flexibilität
- Nicht-Standard Mitreisende für gelegentliche Reisen
- Individuelle Anpassung pro Urlaub möglich
- Keine Einschränkungen

### ✅ Übersichtlichkeit
- Klare Trennung zwischen Standard und Weitere
- Visuelle Kennzeichnung (Stern, gelber Hintergrund)
- Statistiken auf einen Blick

### ✅ Zukunftssicher
- User-ID Feld für Login-Integration
- Vorbereitung für Multi-User-System
- Skalierbar für Teams/Familien

## Technische Details

### Datenbank-Schema

**Tabelle: mitreisende**
```sql
CREATE TABLE mitreisende (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT,
  is_default_member INTEGER DEFAULT 0,  -- 0 = false, 1 = true
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### TypeScript-Typen

```typescript
interface Mitreisender {
  id: string
  name: string
  user_id?: string | null
  is_default_member: boolean
  created_at: string
}
```

### API-Endpunkte

Die bestehenden `/api/mitreisende` Endpunkte wurden erweitert:

- **GET** `/api/mitreisende` - Alle Mitreisenden abrufen
- **POST** `/api/mitreisende` - Neuen Mitreisenden erstellen
  - Body: `{ name: string, userId?: string, isDefaultMember: boolean }`
- **PUT** `/api/mitreisende` - Mitreisenden aktualisieren
  - Body: `{ id: string, name: string, userId?: string, isDefaultMember?: boolean }`
- **DELETE** `/api/mitreisende?id={id}` - Mitreisenden löschen

## Migration bestehender Daten

Bestehende Mitreisende haben standardmäßig `is_default_member = 0` (false).

**Um bestehende Mitreisende als Standard zu markieren:**

1. Navigieren Sie zum "Mitreisende"-Tab
2. Klicken Sie auf das Bearbeiten-Icon (✏️) neben dem Mitreisenden
3. Aktivieren Sie "Als Standard markieren"
4. Klicken Sie auf "Aktualisieren"

Alternativ über SQL (für Bulk-Updates):
```sql
UPDATE mitreisende 
SET is_default_member = 1 
WHERE name IN ('Melli', 'Tom');
```

## Deployment

```bash
git add .
git commit -m "feat: add centralized travelers management with default selection"
git push origin main
```

## Zukünftige Erweiterungen

### 🔐 Benutzer-Authentifizierung
- Login-System mit User-ID Verknüpfung
- Persönliche Mitreisenden-Profile
- Berechtigungen und Zugriffskontrolle

### 👨‍👩‍👧‍👦 Familien/Team-Verwaltung
- Gruppen von Mitreisenden
- Rollen (z.B. Organisator, Teilnehmer)
- Gemeinsame Packlisten

### 📊 Statistiken
- Häufigste Mitreisende
- Reisehistorie pro Person
- Packverhalten-Analyse

### 🎨 Personalisierung
- Profilbilder für Mitreisende
- Farbzuordnung
- Präferenzen und Notizen

## Hinweise

### ⚠️ Löschen von Standard-Mitreisenden
Beim Löschen eines Mitreisenden wird dieser:
- Von allen Urlauben entfernt
- Von allen Ausrüstungsgegenständen entfernt
- Aus allen Packlisten-Zuordnungen entfernt

**Bestätigungsdialog warnt vor dieser Aktion!**

### ℹ️ User-ID Feld
Das User-ID Feld ist aktuell **optional** und dient der Vorbereitung für zukünftige Features. Es kann:
- Leer gelassen werden
- Als E-Mail-Adresse verwendet werden
- Als beliebiger eindeutiger Identifier verwendet werden

## Support

Bei Fragen oder Problemen:
- Überprüfen Sie die Browser-Konsole auf Fehler
- Stellen Sie sicher, dass alle Dateien korrekt deployed wurden
- Testen Sie die Funktionalität in einem privaten Browser-Fenster
