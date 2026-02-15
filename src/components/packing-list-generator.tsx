'use client'

import { useState, useEffect } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Tag as TagIcon } from 'lucide-react'
import { Tag, EquipmentItem } from '@/lib/db'

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
      const res = await fetch('/api/tags')
      const data = await res.json()
      if (data.success) {
        setTags(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch tags:', error)
    }
  }

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
      const data = await res.json()
      if (data.success) {
        setPreviewItems(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch preview:', error)
    }
  }

  const handleToggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
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
                <Label htmlFor="include-standard" className="cursor-pointer">
                  ⭐ Standard-Gegenstände immer einschließen
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
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={() => handleToggleTag(tag.id)}
                      />
                      <Label 
                        htmlFor={`tag-${tag.id}`} 
                        className="flex items-center gap-2 cursor-pointer flex-1"
                      >
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: tag.farbe || '#3b82f6' }}
                        >
                          {tag.icon ? (
                            <span className="text-white text-xs">{tag.icon}</span>
                          ) : (
                            <TagIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm">{tag.titel}</span>
                      </Label>
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
                              <span className="text-xs text-yellow-600">⭐</span>
                            )}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={{ 
                                      backgroundColor: tag.farbe || '#3b82f6',
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
