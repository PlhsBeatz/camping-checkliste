# Fehlerbehebungen: Urlaub & Tags

## 🎯 Behobene Probleme

### 1. ✅ Reiseziel als Pflichtfeld
**Problem:** Urlaub konnte ohne Reiseziel erstellt werden → Fehler "Failed to create vacation"

**Lösung:**
- Reiseziel-Label mit Sternchen markiert: `Reiseziel *`
- Validierung in `handleCreateVacation` erweitert
- Fehlermeldung erscheint, wenn Reiseziel fehlt

**Geänderte Dateien:** `src/app/page.tsx`

### 2. ✅ Mitreisende im Erstell-Dialog bearbeitbar
**Problem:** Checkboxen waren deaktiviert, Standard-Mitreisende nicht vorausgewählt

**Lösung:**
- Checkboxen sind nun immer aktiviert (auch ohne vacationId)
- Standard-Mitreisende werden automatisch vorausgewählt beim Öffnen des Dialogs
- Auswahl wird lokal gespeichert im Erstell-Modus
- Beim Speichern des Urlaubs werden ausgewählte Mitreisende zugeordnet

**Geänderte Dateien:** 
- `src/components/mitreisende-manager.tsx`
- `src/app/page.tsx`

### 3. ✅ Tags werden sofort sichtbar
**Problem:** Tags wurden erst nach Hinzufügen eines neuen Tags angezeigt

**Lösung:**
- Neuer `useEffect` Hook zum Laden der Tags beim Seitenstart
- Tags werden parallel zu anderen Daten geladen

**Geänderte Dateien:** `src/app/page.tsx`

## 📝 Änderungen im Detail

### page.tsx

#### 1. Reiseziel-Validierung (Zeile 452)
```typescript
// Vorher:
if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum) {

// Nachher:
if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum || !newVacationForm.reiseziel_name) {
```

#### 2. Reiseziel-Label (Zeile 860)
```typescript
// Vorher:
<Label htmlFor="reiseziel">Reiseziel</Label>

// Nachher:
<Label htmlFor="reiseziel">Reiseziel *</Label>
```

#### 3. State-Variable (Zeile 33)
```typescript
// Vorher:
const [_vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])

// Nachher:
const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
```

#### 4. Mitreisende-Zuordnung (Zeile 474-488)
```typescript
// Vorher:
// New vacation created - assign default travelers
const defaultTravelers = allMitreisende.filter(m => m.is_default_member)
if (defaultTravelers.length > 0) {
  const defaultIds = defaultTravelers.map(m => m.id)
  await fetch('/api/vacations/mitreisende', { ... })
}

// Nachher:
// New vacation created - assign selected travelers
if (vacationMitreisende.length > 0) {
  const selectedIds = vacationMitreisende.map(m => m.id)
  await fetch('/api/mitreisende', { ... })
}
```

#### 5. Tags laden (Zeile 202-216) - NEU
```typescript
// Fetch Tags
useEffect(() => {
  const fetchTags = async () => {
    try {
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (data.success) {
        setTags(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }
  fetchTags()
}, [])
```

### mitreisende-manager.tsx

#### 1. Neuer State für Initial-Load (Zeile 23)
```typescript
const [initialLoadDone, setInitialLoadDone] = useState(false)
```

#### 2. Automatische Vorauswahl (Zeile 24-51)
```typescript
useEffect(() => {
  const fetchAllMitreisende = async () => {
    // ... fetch logic ...
    
    // Wenn kein vacationId (= Erstell-Modus), wähle Standard-Mitreisende vor
    if (!vacationId && !initialLoadDone) {
      const defaultIds = data.data
        .filter((m: Mitreisender) => m.is_default_member)
        .map((m: Mitreisender) => m.id)
      setVacationMitreisende(defaultIds)
      if (onMitreisendeChange) {
        const defaultMitreisende = data.data.filter((m: Mitreisender) => m.is_default_member)
        onMitreisendeChange(defaultMitreisende)
      }
      setInitialLoadDone(true)
    }
  }
  fetchAllMitreisende()
}, [vacationId, initialLoadDone, onMitreisendeChange])
```

#### 3. Toggle-Logik angepasst (Zeile 75-108)
```typescript
const handleToggleMitreisender = async (mitreisenderId: string) => {
  const newSelection = vacationMitreisende.includes(mitreisenderId)
    ? vacationMitreisende.filter(id => id !== mitreisenderId)
    : [...vacationMitreisende, mitreisenderId]

  setVacationMitreisende(newSelection)

  // Wenn vacationId vorhanden (Edit-Modus), speichere sofort
  if (vacationId) {
    // ... API call ...
  } else {
    // Im Erstell-Modus nur lokal speichern
    if (onMitreisendeChange) {
      const selectedMitreisende = allMitreisende.filter(m => newSelection.includes(m.id))
      onMitreisendeChange(selectedMitreisende)
    }
  }
}
```

#### 4. Checkbox aktiviert (Zeile 236)
```typescript
// Vorher:
<Checkbox
  ...
  disabled={!vacationId}
/>

// Nachher:
<Checkbox
  ...
  // disabled entfernt - immer aktiviert
/>
```

#### 5. Hilfetext angepasst (Zeile 257-261)
```typescript
// Vorher:
{!vacationId && allMitreisende.length > 0 && (
  <p className="text-xs text-muted-foreground">
    Wählen Sie zuerst einen Urlaub aus, um Mitreisende zuzuordnen
  </p>
)}

// Nachher:
{!vacationId && allMitreisende.length > 0 && (
  <p className="text-xs text-muted-foreground">
    💡 Standard-Mitreisende sind automatisch ausgewählt
  </p>
)}
```

## 🚀 Deployment

### Dateien ersetzen:

```bash
# 1. page.tsx ersetzen
cp page_current.tsx src/app/page.tsx

# 2. mitreisende-manager.tsx ersetzen
cp mitreisende-manager-fixed.tsx src/components/mitreisende-manager.tsx

# 3. Committen und pushen
git add src/app/page.tsx src/components/mitreisende-manager.tsx
git commit -m "fix: require destination, enable traveler selection in create mode, load tags on init"
git push origin main
```

## ✅ Nach dem Deployment

### Test-Checkliste:

- [ ] **Reiseziel-Pflichtfeld:**
  - Urlaub ohne Reiseziel erstellen → Fehlermeldung
  - Urlaub mit Reiseziel erstellen → Erfolgreich

- [ ] **Mitreisende-Auswahl:**
  - Dialog öffnen → Standard-Mitreisende vorausgewählt
  - Checkboxen aktivieren/deaktivieren → Funktioniert
  - Urlaub erstellen → Ausgewählte Mitreisende zugeordnet

- [ ] **Tags-Sichtbarkeit:**
  - Seite neu laden → Tags sofort sichtbar
  - Neuen Tag erstellen → Erscheint in der Liste

## 🎯 Workflow

### Urlaub erstellen:
1. "+ Neuer Urlaub" klicken
2. Titel, Startdatum, Enddatum, **Reiseziel** ausfüllen
3. Standard-Mitreisende sind bereits ausgewählt ✅
4. Weitere Mitreisende hinzufügen/entfernen nach Bedarf
5. "Urlaub erstellen" → Erfolg! 🎉

### Tags verwalten:
1. Tab "Tags" öffnen
2. Alle existierenden Tags sind sofort sichtbar ✅
3. Neuen Tag erstellen → Erscheint in der Liste

## 💡 Technische Details

### Erstell-Modus vs. Edit-Modus

**Erstell-Modus** (`vacationId === null`):
- Checkboxen aktiviert
- Standard-Mitreisende vorausgewählt
- Änderungen nur lokal gespeichert
- Beim Speichern: API-Call mit ausgewählten IDs

**Edit-Modus** (`vacationId !== null`):
- Checkboxen aktiviert
- Mitreisende vom Urlaub geladen
- Änderungen sofort in DB gespeichert

### API-Endpunkte

**Mitreisende zuordnen:**
```
PUT /api/mitreisende
Body: {
  vacationId: string,
  mitreisendeIds: string[]
}
```

**Tags laden:**
```
GET /api/tags
Response: {
  success: true,
  data: Tag[]
}
```

## 🎉 Ergebnis

Alle drei Probleme sind behoben:
✅ Reiseziel ist Pflichtfeld
✅ Mitreisende können im Erstell-Dialog ausgewählt werden
✅ Tags werden sofort beim Laden angezeigt
