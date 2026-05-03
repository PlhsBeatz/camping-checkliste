'use client'

import { useState, useEffect, useMemo } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Star } from 'lucide-react'
import { Tag, TagKategorie, EquipmentItem } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { DEFAULT_USER_COLOR_BG } from '@/lib/user-colors'
import { getCachedTags, getCachedTagKategorien } from '@/lib/offline-sync'
import { cacheTags, cacheTagKategorien } from '@/lib/offline-db'

/** Wie auf der Ausrüstungsseite (Chip-Checkboxen) */
const EQUIPMENT_CHIP_CHECKBOX_CLASS =
  'h-3 w-3 shrink-0 border-[rgb(45,79,30)] data-[state=checked]:bg-[rgb(45,79,30)] data-[state=checked]:text-white data-[state=checked]:border-[rgb(45,79,30)] [&_svg]:h-2.5 [&_svg]:w-2.5'

type TagGroupForPicker = { kat: TagKategorie; tags: Tag[] }

interface PackingListGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vacationId: string
  onGenerate: (equipmentItems: EquipmentItem[]) => Promise<void>
}

export function PackingListGenerator({ 
  open, 
  onOpenChange, 
  vacationId: _vacationId, 
  onGenerate 
}: PackingListGeneratorProps) {
  const [tags, setTags] = useState<Tag[]>([])
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [includeStandard, setIncludeStandard] = useState(true)
  const [previewItems, setPreviewItems] = useState<EquipmentItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTags()
    }
  }, [open])

  useEffect(() => {
    if (open) {
      fetchPreview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, includeStandard, open])

  const fetchTags = async () => {
    try {
      const [tagsRes, katRes] = await Promise.all([fetch('/api/tags'), fetch('/api/tag-kategorien')])
      const tagsJson = (await tagsRes.json()) as ApiResponse<Tag[]>
      const katJson = (await katRes.json()) as ApiResponse<TagKategorie[]>
      if (tagsJson.success && tagsJson.data) {
        setTags(tagsJson.data)
        await cacheTags(tagsJson.data)
      }
      if (katJson.success && katJson.data) {
        setTagKategorien(katJson.data)
        await cacheTagKategorien(katJson.data)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const [cachedTags, cachedKat] = await Promise.all([
          getCachedTags(),
          getCachedTagKategorien(),
        ])
        if (cachedTags.length > 0) setTags(cachedTags)
        if (cachedKat.length > 0) setTagKategorien(cachedKat)
      }
    }
  }

  const tagGroupsForPicker = useMemo((): TagGroupForPicker[] => {
    const sortedKats = [...tagKategorien].sort(
      (a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)
    )
    return sortedKats
      .map((kat) => ({
        kat,
        tags: tags
          .filter((t) => t.tag_kategorie_id === kat.id)
          .sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)),
      }))
      .filter((g) => g.tags.length > 0)
  }, [tagKategorien, tags])

  const fetchPreview = async () => {
    if (!includeStandard && selectedTags.length === 0) {
      setPreviewItems([])
      return
    }

    try {
      const params = new URLSearchParams()
      if (includeStandard) {
        params.append('includeStandard', 'true')
      }
      selectedTags.forEach(tagId => params.append('tagIds', tagId))

      const res = await fetch(`/api/equipment-by-tags?${params.toString()}`)
      const data = (await res.json()) as ApiResponse<EquipmentItem[]>
      if (data.success && data.data) {
        setPreviewItems(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch preview:', error)
    }
  }

  const handleToggleTag = (tagId: string, checked: boolean) => {
    setSelectedTags((prev) =>
      checked ? (prev.includes(tagId) ? prev : [...prev, tagId]) : prev.filter((id) => id !== tagId)
    )
  }

  const handleGenerate = async () => {
    if (previewItems.length === 0) {
      alert('Keine Gegenstände ausgewählt')
      return
    }

    setIsLoading(true)
    try {
      await onGenerate(previewItems)
      onOpenChange(false)
      setSelectedTags([])
      setIncludeStandard(true)
    } catch (error) {
      console.error('Failed to generate packing list:', error)
      alert('Fehler beim Generieren der Packliste')
    } finally {
      setIsLoading(false)
    }
  }

  const groupedPreview = previewItems.reduce((acc, item) => {
    const key = item.hauptkategorie_titel || 'Sonstiges'
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(item)
    return acc
  }, {} as Record<string, EquipmentItem[]>)

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Packliste automatisch generieren
        </span>
      }
      description="Wählen Sie Tags aus, um passende Ausrüstungsgegenstände zur Packliste hinzuzufügen"
      contentClassName="max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-6">
          {/* Standard Items Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Standard-Gegenstände</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-standard"
                  checked={includeStandard}
                  onCheckedChange={(checked) => setIncludeStandard(checked as boolean)}
                />
                <Label htmlFor="include-standard" className="cursor-pointer flex items-center gap-2">
                  <Star
                    className="h-4 w-4"
                    style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }}
                  />
                  <span>Standard-Gegenstände immer einschließen</span>
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Gegenstände, die als Standard markiert sind, werden immer vorgeschlagen
              </p>
            </CardContent>
          </Card>

          {/* Tag Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tags auswählen</CardTitle>
            </CardHeader>
            <CardContent>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab &quot;Tags&quot;.
                </p>
              ) : tagGroupsForPicker.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Tags angelegt.
                </p>
              ) : (
                <div className="space-y-4">
                  {tagGroupsForPicker.map(({ kat, tags: catTags }) => (
                    <div key={kat.id} className="space-y-2">
                      <Label className="text-sm font-medium">{kat.titel}</Label>
                      <div className="flex flex-wrap gap-2">
                        {catTags.map((tag) => (
                          <label
                            key={tag.id}
                            htmlFor={`pack-gen-tag-${tag.id}`}
                            className="flex items-center gap-1.5 text-xs bg-background px-2 py-1 rounded cursor-pointer hover:bg-muted/80 border border-border/60"
                          >
                            <Checkbox
                              id={`pack-gen-tag-${tag.id}`}
                              checked={selectedTags.includes(tag.id)}
                              onCheckedChange={(c) => handleToggleTag(tag.id, !!c)}
                              className={EQUIPMENT_CHIP_CHECKBOX_CLASS}
                            />
                            <span>{tag.titel}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Vorschau ({previewItems.length} Gegenstände)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {previewItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Wählen Sie Tags aus, um eine Vorschau zu sehen
                </p>
              ) : (
                <div className="space-y-4 max-h-60 overflow-y-auto">
                  {Object.entries(groupedPreview).map(([hauptkategorie, items]) => (
                    <div key={hauptkategorie}>
                      <h4 className="font-semibold text-sm mb-2">{hauptkategorie}</h4>
                      <div className="space-y-1 ml-4">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">•</span>
                            <span>{item.was}</span>
                            {item.is_standard && (
                              <Star
                                className="h-3.5 w-3.5 flex-shrink-0"
                                style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }}
                              />
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ 
                                      backgroundColor: tag.farbe || DEFAULT_USER_COLOR_BG,
                                      color: 'white'
                                    }}
                                  >
                                    {tag.icon || tag.titel}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isLoading || previewItems.length === 0}
            >
              {isLoading ? 'Wird generiert...' : `${previewItems.length} Gegenstände hinzufügen`}
            </Button>
          </div>
        </div>
    </ResponsiveModal>
  )
}
