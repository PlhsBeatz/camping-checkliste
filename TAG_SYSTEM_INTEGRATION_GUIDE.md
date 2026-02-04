# Tag-System Integration Guide für page.tsx

Diese Datei enthält alle notwendigen Code-Ergänzungen für die Integration des Tag-Systems in `src/app/page.tsx`.

## ✅ Bereits erledigt

Die folgenden Änderungen wurden bereits vorgenommen:
- ✅ Imports hinzugefügt (TagManager, PackingListGenerator, Tag, TagIcon, Sparkles)
- ✅ State-Variablen hinzugefügt (tags, showGeneratorDialog)
- ✅ newEquipmentForm erweitert (is_standard, tags)
- ✅ Tags-Fetching useEffect hinzugefügt

## 📝 Manuelle Änderungen erforderlich

### 1. Equipment-Form Reset-Funktionen erweitern

**Suchen Sie nach allen Stellen, wo `setNewEquipmentForm` mit einem Reset-Objekt aufgerufen wird:**

```typescript
setNewEquipmentForm({
  was: '',
  kategorie_id: '',
  transport_id: '',
  einzelgewicht: '',
  standard_anzahl: '1',
  status: 'Immer gepackt',
  details: '',
  links: [''],
  mitreisenden_typ: 'pauschal' as 'pauschal' | 'alle' | 'ausgewaehlte',
  standard_mitreisende: [] as string[]
})
```

**Ersetzen Sie ALLE diese Vorkommen durch:**

```typescript
setNewEquipmentForm({
  was: '',
  kategorie_id: '',
  transport_id: '',
  einzelgewicht: '',
  standard_anzahl: '1',
  status: 'Immer gepackt',
  details: '',
  is_standard: false,
  tags: [] as string[],
  links: [''],
  mitreisenden_typ: 'pauschal' as 'pauschal' | 'alle' | 'ausgewaehlte',
  standard_mitreisende: [] as string[]
})
```

**Betroffene Funktionen:**
- `handleCreateEquipment` (nach erfolgreichem Speichern)
- `handleCloseEquipmentDialog`

### 2. handleEditEquipment erweitern

**Suchen Sie nach:**

```typescript
const handleEditEquipment = (item: EquipmentItem) => {
  setEditingEquipmentId(item.id)
  setNewEquipmentForm({
    was: item.was,
    kategorie_id: item.kategorie_id,
    transport_id: item.transport_id || '',
    einzelgewicht: item.einzelgewicht ? formatGermanNumber(item.einzelgewicht) : '',
    standard_anzahl: item.standard_anzahl.toString(),
    status: item.status,
    details: item.details || '',
    links: item.links && item.links.length > 0 ? item.links.map(l => l.url) : [''],
    mitreisenden_typ: item.mitreisenden_typ || 'pauschal',
    standard_mitreisende: item.standard_mitreisende || []
  })
```

**Ersetzen Sie durch:**

```typescript
const handleEditEquipment = (item: EquipmentItem) => {
  setEditingEquipmentId(item.id)
  setNewEquipmentForm({
    was: item.was,
    kategorie_id: item.kategorie_id,
    transport_id: item.transport_id || '',
    einzelgewicht: item.einzelgewicht ? formatGermanNumber(item.einzelgewicht) : '',
    standard_anzahl: item.standard_anzahl.toString(),
    status: item.status,
    details: item.details || '',
    is_standard: item.is_standard || false,
    tags: item.tags ? item.tags.map(t => t.id) : [],
    links: item.links && item.links.length > 0 ? item.links.map(l => l.url) : [''],
    mitreisenden_typ: item.mitreisenden_typ || 'pauschal',
    standard_mitreisende: item.standard_mitreisende || []
  })
  setCategorySearchTerm('')
  setShowEquipmentDialog(true)
}
```

### 3. handleCreateEquipment erweitern

**Suchen Sie in `handleCreateEquipment` nach dem body-Objekt:**

```typescript
const body = editingEquipmentId
  ? {
      id: editingEquipmentId,
      was: newEquipmentForm.was,
      kategorie_id: newEquipmentForm.kategorie_id,
      transport_id: newEquipmentForm.transport_id || null,
      einzelgewicht,
      standard_anzahl: parseInt(newEquipmentForm.standard_anzahl),
      status: newEquipmentForm.status,
      details: newEquipmentForm.details,
      links: newEquipmentForm.links.filter(l => l.trim()),
      mitreisenden_typ: newEquipmentForm.mitreisenden_typ,
      standard_mitreisende: newEquipmentForm.standard_mitreisende
    }
  : {
      was: newEquipmentForm.was,
      kategorie_id: newEquipmentForm.kategorie_id,
      transport_id: newEquipmentForm.transport_id || null,
      einzelgewicht,
      standard_anzahl: parseInt(newEquipmentForm.standard_anzahl),
      status: newEquipmentForm.status,
      details: newEquipmentForm.details,
      links: newEquipmentForm.links.filter(l => l.trim()),
      mitreisenden_typ: newEquipmentForm.mitreisenden_typ,
      standard_mitreisende: newEquipmentForm.standard_mitreisende
    }
```

**Ersetzen Sie durch:**

```typescript
const body = editingEquipmentId
  ? {
      id: editingEquipmentId,
      was: newEquipmentForm.was,
      kategorie_id: newEquipmentForm.kategorie_id,
      transport_id: newEquipmentForm.transport_id || null,
      einzelgewicht,
      standard_anzahl: parseInt(newEquipmentForm.standard_anzahl),
      status: newEquipmentForm.status,
      details: newEquipmentForm.details,
      is_standard: newEquipmentForm.is_standard,
      tags: newEquipmentForm.tags,
      links: newEquipmentForm.links.filter(l => l.trim()),
      mitreisenden_typ: newEquipmentForm.mitreisenden_typ,
      standard_mitreisende: newEquipmentForm.standard_mitreisende
    }
  : {
      was: newEquipmentForm.was,
      kategorie_id: newEquipmentForm.kategorie_id,
      transport_id: newEquipmentForm.transport_id || null,
      einzelgewicht,
      standard_anzahl: parseInt(newEquipmentForm.standard_anzahl),
      status: newEquipmentForm.status,
      details: newEquipmentForm.details,
      is_standard: newEquipmentForm.is_standard,
      tags: newEquipmentForm.tags,
      links: newEquipmentForm.links.filter(l => l.trim()),
      mitreisenden_typ: newEquipmentForm.mitreisenden_typ,
      standard_mitreisende: newEquipmentForm.standard_mitreisende
    }
```

### 4. Generator-Funktion hinzufügen

**Fügen Sie diese neue Funktion vor dem `return` Statement ein:**

```typescript
const handleGeneratePackingList = async (equipmentIds: string[]) => {
  if (!selectedVacationId) return

  setIsLoading(true)
  try {
    // Get default travelers for the vacation
    const defaultTravelersRes = await fetch(`/api/mitreisende?vacationId=${selectedVacationId}`)
    const defaultTravelersData = await defaultTravelersRes.json()
    const defaultTravelers = defaultTravelersData.success ? defaultTravelersData.data : []

    // Create packing items for each equipment item
    for (const equipmentId of equipmentIds) {
      const equipment = equipmentItems.find(e => e.id === equipmentId)
      if (!equipment) continue

      // Determine mitreisende based on equipment settings
      let mitreisende: string[] = []
      if (equipment.mitreisenden_typ === 'alle') {
        mitreisende = defaultTravelers.map((m: Mitreisender) => m.id)
      } else if (equipment.mitreisenden_typ === 'ausgewaehlte' && equipment.standard_mitreisende) {
        mitreisende = equipment.standard_mitreisende
      }

      const res = await fetch('/api/packing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacationId: selectedVacationId,
          gegenstandId: equipmentId,
          anzahl: equipment.standard_anzahl || 1,
          bemerkung: '',
          transportId: equipment.transport_id || null,
          mitreisende
        })
      })

      if (!res.ok) {
        console.error(`Failed to add equipment ${equipment.was}`)
      }
    }

    // Refresh packing items
    const refreshRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
    const refreshData = await refreshRes.json()
    if (refreshData.success) {
      setPackingItems(refreshData.data)
    }

    alert(`${equipmentIds.length} Gegenstände zur Packliste hinzugefügt!`)
  } catch (error) {
    console.error('Failed to generate packing list:', error)
    alert('Fehler beim Generieren der Packliste')
  } finally {
    setIsLoading(false)
  }
}
```

### 5. Equipment-Dialog UI erweitern

**Suchen Sie im Equipment-Dialog nach dem "Details"-Feld:**

```typescript
<div>
  <Label htmlFor="details">Details</Label>
  <Input
    id="details"
    placeholder="z.B. 3-Personen Zelt"
    value={newEquipmentForm.details}
    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, details: e.target.value })}
  />
</div>
```

**Fügen Sie NACH diesem Feld folgende zwei neue Felder ein:**

```typescript
{/* Standard-Flag */}
<div className="flex items-center space-x-2 p-3 border rounded-lg bg-yellow-50">
  <input
    type="checkbox"
    id="is-standard"
    checked={newEquipmentForm.is_standard}
    onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, is_standard: e.target.checked })}
    className="h-4 w-4 rounded border-gray-300"
  />
  <label htmlFor="is-standard" className="text-sm cursor-pointer flex items-center gap-2">
    <span className="text-lg">⭐</span>
    <div>
      <div className="font-medium">Als Standard markieren</div>
      <div className="text-xs text-muted-foreground">
        Wird bei automatischer Packlisten-Generierung immer vorgeschlagen
      </div>
    </div>
  </label>
</div>

{/* Tags */}
<div>
  <Label>Tags für Packlisten-Generierung</Label>
  <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
    {tags.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-2">
        Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab "Tags".
      </p>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`tag-${tag.id}`}
              checked={newEquipmentForm.tags.includes(tag.id)}
              onChange={(e) => {
                const newTags = e.target.checked
                  ? [...newEquipmentForm.tags, tag.id]
                  : newEquipmentForm.tags.filter(id => id !== tag.id)
                setNewEquipmentForm({ ...newEquipmentForm, tags: newTags })
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor={`tag-${tag.id}`} className="text-sm cursor-pointer flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: tag.farbe || '#3b82f6' }}
              />
              {tag.icon && <span>{tag.icon}</span>}
              {tag.titel}
            </label>
          </div>
        ))}
      </div>
    )}
  </div>
  <p className="text-xs text-muted-foreground mt-1">
    Tags helfen bei der automatischen Generierung von Packlisten (z.B. Sommer, Strand, Feuerküche)
  </p>
</div>
```

### 6. Tabs-Navigation erweitern

**Suchen Sie nach der TabsList:**

```typescript
<TabsList className="grid w-full grid-cols-5">
  <TabsTrigger value="equipment">...</TabsTrigger>
  <TabsTrigger value="categories">...</TabsTrigger>
  <TabsTrigger value="travelers">...</TabsTrigger>
  <TabsTrigger value="vacations">...</TabsTrigger>
  <TabsTrigger value="packing">...</TabsTrigger>
</TabsList>
```

**Ändern Sie `grid-cols-5` zu `grid-cols-6` und fügen Sie einen neuen Tab hinzu:**

```typescript
<TabsList className="grid w-full grid-cols-6">
  <TabsTrigger value="equipment">
    <Package className="h-4 w-4 mr-2" />
    Ausrüstung
  </TabsTrigger>
  <TabsTrigger value="categories">
    <FolderTree className="h-4 w-4 mr-2" />
    Kategorien
  </TabsTrigger>
  <TabsTrigger value="tags">
    <TagIcon className="h-4 w-4 mr-2" />
    Tags
  </TabsTrigger>
  <TabsTrigger value="travelers">
    <UserCircle className="h-4 w-4 mr-2" />
    Mitreisende
  </TabsTrigger>
  <TabsTrigger value="vacations">
    <MapPin className="h-4 w-4 mr-2" />
    Urlaube
  </TabsTrigger>
  <TabsTrigger value="packing">
    <Users className="h-4 w-4 mr-2" />
    Packliste
  </TabsTrigger>
</TabsList>
```

### 7. Tags-Tab Content hinzufügen

**Suchen Sie nach dem `<TabsContent value="categories">` Block und fügen Sie NACH diesem Block ein:**

```typescript
{/* Tags Tab */}
<TabsContent value="tags">
  <TagManager 
    tags={tags} 
    onRefresh={() => {
      fetch('/api/tags')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setTags(data.data)
          }
        })
    }} 
  />
</TabsContent>
```

### 8. Generator-Button in Packliste hinzufügen

**Suchen Sie im Packing-Tab nach dem Header mit "Packliste" und dem "+ Gegenstand hinzufügen" Button:**

```typescript
<div className="flex justify-between items-center mb-4">
  <h2 className="text-2xl font-bold">
    Packliste: {currentVacation?.titel || 'Kein Urlaub ausgewählt'}
  </h2>
  <Button
    onClick={() => setShowAddItemDialog(true)}
    disabled={!selectedVacationId}
  >
    <Plus className="h-4 w-4 mr-2" />
    Gegenstand hinzufügen
  </Button>
</div>
```

**Ersetzen Sie durch:**

```typescript
<div className="flex justify-between items-center mb-4">
  <h2 className="text-2xl font-bold">
    Packliste: {currentVacation?.titel || 'Kein Urlaub ausgewählt'}
  </h2>
  <div className="flex gap-2">
    <Button
      onClick={() => setShowGeneratorDialog(true)}
      disabled={!selectedVacationId}
      variant="outline"
    >
      <Sparkles className="h-4 w-4 mr-2" />
      Automatisch generieren
    </Button>
    <Button
      onClick={() => setShowAddItemDialog(true)}
      disabled={!selectedVacationId}
    >
      <Plus className="h-4 w-4 mr-2" />
      Gegenstand hinzufügen
    </Button>
  </div>
</div>
```

### 9. Generator-Dialog am Ende einfügen

**Fügen Sie ganz am Ende, kurz vor dem schließenden `</Layout>` Tag, ein:**

```typescript
{/* Packing List Generator Dialog */}
<PackingListGenerator
  open={showGeneratorDialog}
  onOpenChange={setShowGeneratorDialog}
  vacationId={selectedVacationId || ''}
  onGenerate={handleGeneratePackingList}
/>
```

## 🎯 Zusammenfassung

Nach diesen Änderungen haben Sie:
- ✅ Tag-Verwaltung im eigenen Tab
- ✅ Standard-Flag für Ausrüstungsgegenstände
- ✅ Tag-Zuordnung für Ausrüstungsgegenstände
- ✅ Automatische Packlisten-Generierung mit Tag-Auswahl
- ✅ Vollständige Integration in die bestehende UI

## 🚀 Nächste Schritte

1. Führen Sie die SQL-Migration aus: `migrations/add_tags_system.sql`
2. Testen Sie die Tag-Verwaltung
3. Erstellen Sie einige Tags (z.B. Sommer, Strand, Feuerküche)
4. Markieren Sie Ausrüstungsgegenstände mit Tags
5. Testen Sie die automatische Generierung

Bei Fragen oder Problemen, siehe die vollständige Dokumentation in `TAG_SYSTEM_DOCUMENTATION.md`.
