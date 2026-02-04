# Kategorie-Verwaltung Feature

## Übersicht

Die Kategorie-Verwaltung ermöglicht es Benutzern, Hauptkategorien und Kategorien für Ausrüstungsgegenstände zu erstellen, zu bearbeiten und zu löschen.

## Implementierte Funktionen

### Backend (Datenbank-Funktionen)

**Datei:** `src/lib/db.ts`

#### Hauptkategorien
- `createMainCategory(db, titel, reihenfolge?)` - Neue Hauptkategorie erstellen
- `updateMainCategory(db, id, titel, reihenfolge?)` - Hauptkategorie aktualisieren
- `deleteMainCategory(db, id)` - Hauptkategorie löschen (nur wenn keine Kategorien zugeordnet sind)

#### Kategorien
- `createCategory(db, titel, hauptkategorieId, reihenfolge?)` - Neue Kategorie erstellen
- `updateCategory(db, id, titel, hauptkategorieId?, reihenfolge?)` - Kategorie aktualisieren
- `deleteCategory(db, id)` - Kategorie löschen (nur wenn keine Ausrüstungsgegenstände zugeordnet sind)

### Backend (API-Routen)

#### Hauptkategorien API
**Datei:** `src/app/api/main-categories/route.ts`

- **GET** `/api/main-categories` - Alle Hauptkategorien abrufen
- **POST** `/api/main-categories` - Neue Hauptkategorie erstellen
  - Body: `{ titel: string, reihenfolge?: number }`
- **PUT** `/api/main-categories` - Hauptkategorie aktualisieren
  - Body: `{ id: string, titel: string, reihenfolge?: number }`
- **DELETE** `/api/main-categories?id={id}` - Hauptkategorie löschen

#### Kategorien API
**Datei:** `src/app/api/categories/route.ts`

- **GET** `/api/categories` - Alle Kategorien mit Hauptkategorien abrufen
- **POST** `/api/categories` - Neue Kategorie erstellen
  - Body: `{ titel: string, hauptkategorieId: string, reihenfolge?: number }`
- **PUT** `/api/categories` - Kategorie aktualisieren
  - Body: `{ id: string, titel: string, hauptkategorieId?: string, reihenfolge?: number }`
- **DELETE** `/api/categories?id={id}` - Kategorie löschen

### Frontend (UI-Komponente)

**Datei:** `src/components/category-manager.tsx`

Die `CategoryManager` Komponente bietet eine vollständige Benutzeroberfläche für:

#### Hauptkategorien-Verwaltung
- ✅ Liste aller Hauptkategorien mit Reihenfolge
- ✅ Erstellen neuer Hauptkategorien
- ✅ Bearbeiten bestehender Hauptkategorien
- ✅ Löschen von Hauptkategorien (mit Validierung)
- ✅ Icon: Ordner-Symbol für visuelle Identifikation

#### Kategorien-Verwaltung
- ✅ Gruppierte Anzeige nach Hauptkategorien
- ✅ Erstellen neuer Kategorien mit Hauptkategorie-Auswahl
- ✅ Bearbeiten bestehender Kategorien
- ✅ Löschen von Kategorien (mit Validierung)
- ✅ Dropdown für Hauptkategorie-Auswahl

### Frontend (Integration)

**Datei:** `src/app/page.tsx`

#### Neue Imports
- `CategoryManager` Komponente
- `MainCategory` Typ aus `@/lib/db`
- `FolderTree` Icon aus lucide-react

#### Neuer State
```typescript
const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
```

#### Neuer useEffect Hook
Lädt Hauptkategorien beim App-Start:
```typescript
useEffect(() => {
  const fetchMainCategories = async () => {
    const res = await fetch('/api/main-categories')
    const data = await res.json()
    if (data.success) setMainCategories(data.data)
  }
  fetchMainCategories()
}, [])
```

#### Neuer Tab
- **Tab-Name:** "Kategorien"
- **Icon:** FolderTree
- **Position:** Zwischen "Ausrüstung" und "Urlaube"
- **Inhalt:** CategoryManager-Komponente mit Auto-Refresh

## Benutzeroberfläche

### Layout

```
┌─────────────────────────────────────────────┐
│ Kategorien verwalten                        │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─ Hauptkategorien ──────────────────────┐ │
│ │  [+ Neue Hauptkategorie]               │ │
│ │                                         │ │
│ │  📁 Campingausrüstung (Reihenfolge: 1) │ │
│ │     [✏️] [🗑️]                           │ │
│ │                                         │ │
│ │  📁 Küche & Co. (Reihenfolge: 2)       │ │
│ │     [✏️] [🗑️]                           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─ Kategorien ───────────────────────────┐ │
│ │  [+ Neue Kategorie]                    │ │
│ │                                         │ │
│ │  Campingausrüstung                     │ │
│ │    • Grundausstattung (Reihenfolge: 1) │ │
│ │      [✏️] [🗑️]                          │ │
│ │    • Kochen und Grillen (Reihenfolge:2)│ │
│ │      [✏️] [🗑️]                          │ │
│ │                                         │ │
│ │  Küche & Co.                           │ │
│ │    • Geschirr (Reihenfolge: 1)         │ │
│ │      [✏️] [🗑️]                          │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Dialoge

#### Hauptkategorie erstellen/bearbeiten
- **Titel** (Pflichtfeld): Text-Input
- **Reihenfolge** (Optional): Nummer-Input
- **Button:** "Erstellen" oder "Aktualisieren"

#### Kategorie erstellen/bearbeiten
- **Titel** (Pflichtfeld): Text-Input
- **Hauptkategorie** (Pflichtfeld): Dropdown-Auswahl
- **Reihenfolge** (Optional): Nummer-Input
- **Button:** "Erstellen" oder "Aktualisieren"

## Validierung

### Hauptkategorien
- ✅ Titel ist Pflichtfeld
- ✅ Kann nicht gelöscht werden, wenn Kategorien zugeordnet sind
- ✅ Fehlermeldung: "Cannot delete main category with existing categories"

### Kategorien
- ✅ Titel und Hauptkategorie sind Pflichtfelder
- ✅ Kann nicht gelöscht werden, wenn Ausrüstungsgegenstände zugeordnet sind
- ✅ Fehlermeldung: "Cannot delete category with existing equipment items"

## Fehlerbehandlung

Alle API-Aufrufe haben:
- Try-catch Blöcke für Netzwerkfehler
- Benutzerfreundliche Alert-Meldungen
- Console-Logging für Debugging
- Loading-States während Operationen

## Deployment

```bash
# Entpacken Sie die ZIP-Datei
git add .
git commit -m "feat: add category and main category management"
git push origin main
```

## Verwendung

1. **Navigieren Sie zum "Kategorien"-Tab** in der Hauptnavigation
2. **Hauptkategorie erstellen:**
   - Klicken Sie auf "+ Neue Hauptkategorie"
   - Geben Sie einen Titel ein (z.B. "Campingausrüstung")
   - Optional: Geben Sie eine Reihenfolge ein
   - Klicken Sie auf "Erstellen"

3. **Kategorie erstellen:**
   - Klicken Sie auf "+ Neue Kategorie"
   - Geben Sie einen Titel ein (z.B. "Grundausstattung")
   - Wählen Sie eine Hauptkategorie aus dem Dropdown
   - Optional: Geben Sie eine Reihenfolge ein
   - Klicken Sie auf "Erstellen"

4. **Bearbeiten:**
   - Klicken Sie auf das Stift-Symbol (✏️) neben der Kategorie
   - Ändern Sie die gewünschten Felder
   - Klicken Sie auf "Aktualisieren"

5. **Löschen:**
   - Klicken Sie auf das Papierkorb-Symbol (🗑️)
   - Bestätigen Sie die Löschung
   - Hinweis: Löschen ist nur möglich, wenn keine abhängigen Einträge existieren

## Technische Details

### Datenbank-Schema

**Tabelle: hauptkategorien**
- `id` (TEXT, PRIMARY KEY)
- `titel` (TEXT)
- `reihenfolge` (INTEGER)

**Tabelle: kategorien**
- `id` (TEXT, PRIMARY KEY)
- `titel` (TEXT)
- `hauptkategorie_id` (TEXT, FOREIGN KEY)
- `reihenfolge` (INTEGER)

### TypeScript-Typen

```typescript
interface MainCategory {
  id: string
  titel: string
  reihenfolge: number
}

interface Category {
  id: string
  titel: string
  hauptkategorie_id: string
  reihenfolge: number
}

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}
```

## Zukünftige Erweiterungen

- 🔄 Drag & Drop für Reihenfolge-Änderungen
- 🔍 Suchfunktion für Kategorien
- 📊 Statistiken (Anzahl der Gegenstände pro Kategorie)
- 🎨 Farbzuordnung für Kategorien
- 📁 Verschachtelte Unterkategorien
