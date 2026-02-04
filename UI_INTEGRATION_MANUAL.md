# UI-Integration Anleitung für page.tsx

## ✅ Bereits erledigt (automatisch)

Die folgenden Backend-Änderungen wurden bereits angewendet:
- ✅ Imports aktualisiert (TagManager, PackingListGenerator, Tag, TagIcon, Sparkles)
- ✅ State-Variablen hinzugefügt (tags, showGeneratorDialog)
- ✅ newEquipmentForm erweitert (is_standard, tags)
- ✅ Tags-Fetching useEffect hinzugefügt
- ✅ Alle Form-Reset-Aufrufe aktualisiert
- ✅ handleEditEquipment aktualisiert
- ✅ handleCreateEquipment body aktualisiert

## 📝 Manuelle UI-Änderungen erforderlich

### 1. Generator-Funktion hinzufügen

**Suchen Sie nach:** `const handleCloseEquipmentDialog`

**Fügen Sie VOR dieser Funktion ein:**

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

### 2. Tabs-Navigation erweitern

**Suchen Sie nach:**
```typescript
<TabsList className="grid w-full grid-cols-5">
```

**Ersetzen Sie durch:**
```typescript
<TabsList className="grid w-full grid-cols-6">
```

**Suchen Sie dann nach dem Tab "categories" und fügen Sie NACH diesem Tab ein:**

```typescript
          <TabsTrigger value="tags">
            <TagIcon className="h-4 w-4 mr-2" />
            Tags
          </TabsTrigger>
```

### 3. Tags-Tab Content hinzufügen

**Suchen Sie nach:**
```typescript
        {/* Categories Tab */}
        <TabsContent value="categories">
          <CategoryManager 
            categories={categories}
            mainCategories={mainCategories}
            onRefresh={() => {
              // Refresh categories
              fetch('/api/categories')
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    setCategories(data.data)
                  }
                })
              // Refresh main categories
              fetch('/api/main-categories')
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    setMainCategories(data.data)
                  }
                })
            }} 
          />
        </TabsContent>
```

**Fügen Sie NACH diesem Block ein:**

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

### 4. Generator-Button in Packliste hinzufügen

**Suchen Sie nach:**
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

### 5. Equipment-Dialog erweitern

**Suchen Sie im Equipment-Dialog nach:**
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

**Fügen Sie NACH diesem Block ein:**

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

### 6. Generator-Dialog am Ende einfügen

**Suchen Sie nach dem Ende des `return` Statements, kurz vor dem schließenden `</Layout>` Tag.**

**Fügen Sie DAVOR ein:**

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

Nach diesen 6 manuellen Schritten haben Sie:
- ✅ Generator-Funktion implementiert
- ✅ Tags-Tab in der Navigation
- ✅ Tag-Manager-Komponente integriert
- ✅ Generator-Button in der Packliste
- ✅ Standard-Flag und Tag-Auswahl im Equipment-Dialog
- ✅ Generator-Dialog-Komponente

## 🧪 Testen

Nach der Implementierung:
1. Build starten: `pnpm run build`
2. Bei Fehlern: TypeScript-Fehler prüfen
3. Lokal testen: Tags erstellen, Equipment taggen, Generator verwenden
4. Deployment: `git push origin main`

## 💡 Tipps

- Verwenden Sie die Suchfunktion Ihres Editors (Ctrl+F)
- Achten Sie auf korrekte Einrückung
- Prüfen Sie geschlossene Klammern
- Bei Unsicherheiten: Vergleichen Sie mit den Beispielen im Integration Guide

Bei Fragen oder Problemen: Siehe TAG_SYSTEM_DOCUMENTATION.md
