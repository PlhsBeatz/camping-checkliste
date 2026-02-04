# ESLint-Fehler Behebung

## Problem

Build-Fehler in `page.tsx` Zeile 1372 mit unescaped quotes.

## Lösung

### Fehler in Zeile 1372

Wenn Sie Schritt 5 (Equipment-Dialog-Erweiterung) eingefügt haben, suchen Sie nach diesem Text:

```typescript
Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab "Tags".
```

**Ersetzen Sie durch:**

```typescript
Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab &quot;Tags&quot;.
```

### Vollständiger korrigierter Code für Equipment-Dialog Tags-Sektion

```typescript
                        {/* Tags */}
                        <div>
                          <Label>Tags für Packlisten-Generierung</Label>
                          <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                            {tags.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab &quot;Tags&quot;.
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

## Alle behobenen Dateien

### 1. ✅ packing-list-generator.tsx
- Unused `vacationId` → `_vacationId`
- Missing dependency → eslint-disable comment
- Unescaped quotes → `&quot;`

### 2. ✅ textarea.tsx
- Empty interface warning → eslint-disable comment

### 3. ⚠️ page.tsx (Ihre manuelle Änderung)
- Zeile 1372: `"Tags"` → `&quot;Tags&quot;`

## Alternative: Einfache Anführungszeichen verwenden

Statt HTML-Entities können Sie auch einfache Anführungszeichen verwenden:

```typescript
Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab 'Tags'.
```

Oder ganz ohne Anführungszeichen:

```typescript
Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tags-Tab.
```

## Schnelle Suche & Ersetzen

In Ihrem Editor (VS Code, etc.):

1. Öffnen Sie `src/app/page.tsx`
2. Suchen (Ctrl+F): `Tab "Tags"`
3. Ersetzen durch: `Tab &quot;Tags&quot;`
4. Oder ersetzen durch: `Tags-Tab`

## Nach der Korrektur

```bash
# Lokal testen (falls möglich)
pnpm run build

# Oder direkt committen und pushen
git add src/app/page.tsx src/components/packing-list-generator.tsx src/components/ui/textarea.tsx
git commit -m "fix: escape quotes and fix ESLint errors"
git push origin main
```

## Zusätzliche Hinweise

Falls weitere Zeilen mit Quotes-Fehlern auftreten:
- Suchen Sie nach `"` in JSX-Text
- Ersetzen Sie durch `&quot;` oder `'`
- Oder verwenden Sie Template-Strings: `` `Tab "Tags"` ``
