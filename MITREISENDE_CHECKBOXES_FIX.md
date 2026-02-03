# Fix: Individuelle Mitreisenden-Checkboxen

## Problem

Die individuellen Checkboxen für Mitreisende wurden in der Packliste nicht angezeigt, obwohl Gegenstände mit "Jeder einzeln" oder "Nur ausgewählte" hinzugefügt wurden.

## Ursache

Beim Hinzufügen eines Packlisteneintrags wurden die `mitreisende` IDs nicht an die API gesendet. Die Funktion `handleAddPackingItem` in `page.tsx` hat nur folgende Felder gesendet:
- `vacationId`
- `gegenstandId`
- `anzahl`
- `bemerkung`
- `transportId`

Das Feld `mitreisende` (Array von IDs) fehlte komplett.

## Lösung

Die Funktion `handleAddPackingItem` wurde erweitert, um die richtigen Mitreisenden-IDs basierend auf dem `mitreisenden_typ` des Ausrüstungsgegenstands zu ermitteln und mitzusenden:

### Logik

1. **Pauschal** (`mitreisenden_typ === 'pauschal'`):
   - Keine Mitreisenden-IDs werden gesendet
   - Ein einzelnes Checkbox für den gesamten Artikel

2. **Alle** (`mitreisenden_typ === 'alle'`):
   - Alle Mitreisenden des aktuellen Urlaubs werden verwendet
   - `mitreisendeIds = _vacationMitreisende.map(m => m.id)`
   - Jeder Mitreisende bekommt ein eigenes Checkbox

3. **Ausgewählte** (`mitreisenden_typ === 'ausgewaehlte'`):
   - Die `standard_mitreisende` aus dem Ausrüstungsgegenstand werden verwendet
   - `mitreisendeIds = selectedEquipment.standard_mitreisende || []`
   - Nur ausgewählte Mitreisende bekommen Checkboxen

### Code-Änderungen

**Datei:** `src/app/page.tsx`

**Zeilen 293-306 (NEU):**
```typescript
// Find the selected equipment item to get mitreisenden_typ and standard_mitreisende
const selectedEquipment = equipmentItems.find(item => item.id === packingItemForm.gegenstandId)
let mitreisendeIds: string[] = []

if (selectedEquipment) {
  if (selectedEquipment.mitreisenden_typ === 'alle') {
    // Use all mitreisende from the vacation
    mitreisendeIds = _vacationMitreisende.map(m => m.id)
  } else if (selectedEquipment.mitreisenden_typ === 'ausgewaehlte') {
    // Use standard_mitreisende from the equipment item
    mitreisendeIds = selectedEquipment.standard_mitreisende || []
  }
  // For 'pauschal', mitreisendeIds remains empty
}
```

**Zeile 319 (NEU):**
```typescript
mitreisende: mitreisendeIds
```

## Ergebnis

Nach diesem Fix werden beim Hinzufügen eines Packlisteneintrags:

1. Die richtigen Mitreisenden automatisch zugeordnet
2. In der Datenbank-Tabelle `packlisten_eintrag_mitreisende` gespeichert
3. Beim Laden der Packliste korrekt angezeigt
4. Individuelle Checkboxen für jeden zugeordneten Mitreisenden gerendert

## Testen

1. Erstellen Sie einen Urlaub mit mehreren Mitreisenden (z.B. "Melli", "Luisa", "Tom")
2. Erstellen Sie einen Ausrüstungsgegenstand mit:
   - **"Jeder einzeln"** → Alle Mitreisende des Urlaubs sollten Checkboxen bekommen
   - **"Nur ausgewählte"** → Nur die ausgewählten Mitreisenden sollten Checkboxen bekommen
3. Fügen Sie den Gegenstand zur Packliste hinzu
4. In der Packliste sollten nun individuelle Checkboxen für jeden zugeordneten Mitreisenden erscheinen
5. Beim Abhaken eines Mitreisenden sollte der Status gespeichert werden

## Deployment

```bash
# Entpacken Sie die ZIP-Datei
git add src/app/page.tsx
git commit -m "fix: add mitreisende IDs when creating packing items"
git push origin main
```

Nach dem Deployment müssen Sie:
1. **Bestehende Packlistenartikel löschen** (die ohne Mitreisenden-Zuordnung erstellt wurden)
2. **Neu hinzufügen** - dann werden die Mitreisenden korrekt zugeordnet
3. Die individuellen Checkboxen sollten nun erscheinen

## Hinweis

Bestehende Packlistenartikel, die vor diesem Fix erstellt wurden, haben keine Mitreisenden-Zuordnungen in der Datenbank. Diese müssen gelöscht und neu hinzugefügt werden, damit die Checkboxen erscheinen.
