# Schritt 4 Korrigiert: Generator-Button hinzufügen

## Ihre aktuelle Struktur

```typescript
<CardContent>
  <div className="space-y-4">
    {currentVacation && (
      <div className="flex justify-end">
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Gegenstand hinzufügen
            </Button>
          </DialogTrigger>
```

## Angepasste Lösung

**Ersetzen Sie:**
```typescript
      <div className="flex justify-end">
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Gegenstand hinzufügen
            </Button>
          </DialogTrigger>
```

**Durch:**
```typescript
      <div className="flex justify-end gap-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setShowGeneratorDialog(true)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Automatisch generieren
        </Button>
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Gegenstand hinzufügen
            </Button>
          </DialogTrigger>
```

## Änderungen im Detail

1. **`gap-2` hinzugefügt:** Abstand zwischen den Buttons
2. **Generator-Button eingefügt:** Vor dem Dialog
3. **`variant="outline"`:** Visuell unterscheidbar vom Haupt-Button
4. **`onClick` Handler:** Öffnet den Generator-Dialog

## Visuelles Ergebnis

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [✨ Automatisch generieren]  [+ Gegen- │
│                                            stand    │
│                                            hinzufü- │
│                                            gen]     │
└─────────────────────────────────────────────────────┘
```

## Alternative: Mit Tooltip

Falls Sie einen Tooltip hinzufügen möchten:

```typescript
      <div className="flex justify-end gap-2">
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setShowGeneratorDialog(true)}
          title="Packliste automatisch basierend auf Tags und Standard-Gegenständen generieren"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Automatisch generieren
        </Button>
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Gegenstand hinzufügen
            </Button>
          </DialogTrigger>
```

## Testen

Nach der Änderung sollten Sie:
1. Zwei Buttons nebeneinander sehen
2. Der linke Button (Generator) hat einen Outline-Style
3. Klick auf Generator öffnet den Generator-Dialog (nach Schritt 6)
4. Klick auf "Gegenstand hinzufügen" öffnet wie gewohnt den Dialog

## Falls der Generator-Button nicht funktioniert

Stellen Sie sicher, dass:
- ✅ `showGeneratorDialog` State existiert (Schritt 3 aus apply_all_changes.sh)
- ✅ `Sparkles` Icon importiert ist (automatisch erledigt)
- ✅ Generator-Dialog am Ende eingefügt wurde (Schritt 6)
