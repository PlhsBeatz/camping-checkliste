import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Pencil, Plus, Trash2, Tag as TagIcon, GripVertical } from 'lucide-react'
import { Tag, TagKategorie } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { USER_COLORS, DEFAULT_USER_COLOR_BG, toColorInputValue } from '@/lib/user-colors'
import type { ReactNode } from 'react'

type TagKategorieWithTags = TagKategorie & { tags: Tag[] }

function SortableTagRow({
  tag,
  onEdit,
  onDelete,
}: {
  tag: Tag
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag.id })
  const [menuOpen, setMenuOpen] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 rounded-md hover:bg-muted/50 border-b border-border/60 last:border-0"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-1 text-muted-foreground/70 cursor-grab active:cursor-grabbing shrink-0"
        style={{ touchAction: 'none' }}
        aria-label="Zum Sortieren ziehen"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: tag.farbe || DEFAULT_USER_COLOR_BG }}
        >
          {tag.icon ? (
            <span className="text-white text-sm">{tag.icon}</span>
          ) : (
            <TagIcon className="h-4 w-4 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{tag.titel}</p>
          {tag.beschreibung && (
            <p className="text-xs text-muted-foreground truncate">{tag.beschreibung}</p>
          )}
        </div>
      </div>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onEdit()
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false)
              onDelete()
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SortableTagCategoryRow({
  kat,
  isCompact,
  children,
}: {
  kat: TagKategorieWithTags
  isCompact: boolean
  children: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center gap-2 p-3 py-1">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          style={{ touchAction: 'none' }}
          aria-label="Kategorie zum Sortieren ziehen"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[rgb(45,79,30)]">{kat.titel}</p>
        </div>
      </div>
      {!isCompact && (
        <div className="px-3 pb-2 space-y-1">
          {children}
          {kat.tags.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">Keine Tags in dieser Kategorie</p>
          )}
        </div>
      )}
    </div>
  )
}

interface TagManagerProps {
  tagKategorien: TagKategorie[]
  tags: Tag[]
  onRefresh: () => void
}

export function TagManager({ tagKategorien, tags, onRefresh }: TagManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [draggingTagKatId, setDraggingTagKatId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const tagKategorienSorted = useMemo(
    () => [...tagKategorien].sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)),
    [tagKategorien]
  )

  const tagsByKat: TagKategorieWithTags[] = useMemo(
    () =>
      tagKategorienSorted.map((k) => ({
        ...k,
        tags: tags
          .filter((t) => t.tag_kategorie_id === k.id)
          .sort((a, b) => a.reihenfolge - b.reihenfolge || a.titel.localeCompare(b.titel)),
      })),
    [tagKategorienSorted, tags]
  )

  const defaultKategorieId = tagKategorienSorted[0]?.id ?? ''

  const [form, setForm] = useState({
    titel: '',
    farbe: DEFAULT_USER_COLOR_BG,
    icon: '',
    beschreibung: '',
    tag_kategorie_id: '',
  })

  useEffect(() => {
    if (form.tag_kategorie_id === '' && defaultKategorieId) {
      setForm((f) => ({ ...f, tag_kategorie_id: defaultKategorieId }))
    }
  }, [defaultKategorieId, form.tag_kategorie_id])

  const handleCreate = async () => {
    if (!form.titel.trim() || !form.tag_kategorie_id) {
      alert('Bitte Titel und Kategorie wählen')
      return
    }

    const inCat = tags.filter((t) => t.tag_kategorie_id === form.tag_kategorie_id)
    const nextReihenfolge = inCat.length > 0 ? Math.max(...inCat.map((t) => t.reihenfolge)) + 1 : 0

    setIsLoading(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: form.titel,
          tag_kategorie_id: form.tag_kategorie_id,
          reihenfolge: nextReihenfolge,
          farbe: form.farbe,
          icon: form.icon || null,
          beschreibung: form.beschreibung || null,
        }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setForm({
          titel: '',
          farbe: DEFAULT_USER_COLOR_BG,
          icon: '',
          beschreibung: '',
          tag_kategorie_id: defaultKategorieId,
        })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create tag:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingTag || !form.titel.trim() || !form.tag_kategorie_id) {
      alert('Bitte Titel und Kategorie wählen')
      return
    }

    let reihenfolge = editingTag.reihenfolge
    if (form.tag_kategorie_id !== editingTag.tag_kategorie_id) {
      const inCat = tags.filter((t) => t.tag_kategorie_id === form.tag_kategorie_id && t.id !== editingTag.id)
      reihenfolge = inCat.length > 0 ? Math.max(...inCat.map((t) => t.reihenfolge)) + 1 : 0
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTag.id,
          titel: form.titel,
          tag_kategorie_id: form.tag_kategorie_id,
          reihenfolge,
          farbe: form.farbe,
          icon: form.icon || null,
          beschreibung: form.beschreibung || null,
        }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setEditingTag(null)
        setForm({
          titel: '',
          farbe: DEFAULT_USER_COLOR_BG,
          icon: '',
          beschreibung: '',
          tag_kategorie_id: defaultKategorieId,
        })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update tag:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    setDeleteTagId(id)
  }

  const executeDeleteTag = async () => {
    if (!deleteTagId) return
    const id = deleteTagId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/tags?id=${id}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete tag:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const openEdit = (tag: Tag) => {
    setEditingTag(tag)
    setForm({
      titel: tag.titel,
      farbe: tag.farbe || DEFAULT_USER_COLOR_BG,
      icon: tag.icon || '',
      beschreibung: tag.beschreibung || '',
      tag_kategorie_id: tag.tag_kategorie_id || defaultKategorieId,
    })
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingTag(null)
    setForm({
      titel: '',
      farbe: DEFAULT_USER_COLOR_BG,
      icon: '',
      beschreibung: '',
      tag_kategorie_id: defaultKategorieId,
    })
    setShowDialog(true)
  }

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const katIds = new Set(tagKategorien.map((k) => k.id))
      if (katIds.has(event.active.id as string)) {
        setDraggingTagKatId(event.active.id as string)
      }
    },
    [tagKategorien]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDraggingTagKatId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const katIds = new Set(tagKategorien.map((k) => k.id))

      if (katIds.has(active.id as string)) {
        const oldIndex = tagKategorienSorted.findIndex((m) => m.id === active.id)
        const newIndex = tagKategorienSorted.findIndex((m) => m.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove([...tagKategorienSorted], oldIndex, newIndex)
        setIsLoading(true)
        try {
          for (let i = 0; i < reordered.length; i++) {
            const k = reordered[i]
            if (!k) continue
            await fetch('/api/tag-kategorien', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: k.id, titel: k.titel, reihenfolge: i }),
            })
          }
          onRefresh()
        } catch (e) {
          console.error('Failed to reorder tag categories:', e)
          onRefresh()
        } finally {
          setIsLoading(false)
        }
      } else {
        const mainKat = tagsByKat.find((m) => m.tags.some((t) => t.id === active.id))
        if (!mainKat) return

        const subTags = mainKat.tags
        const oldIndex = subTags.findIndex((t) => t.id === active.id)
        const newIndex = subTags.findIndex((t) => t.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove([...subTags], oldIndex, newIndex)
        setIsLoading(true)
        try {
          for (let i = 0; i < reordered.length; i++) {
            const t = reordered[i]
            if (!t) continue
            await fetch('/api/tags', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: t.id,
                titel: t.titel,
                tag_kategorie_id: mainKat.id,
                reihenfolge: i,
                farbe: t.farbe,
                icon: t.icon,
                beschreibung: t.beschreibung,
              }),
            })
          }
          onRefresh()
        } catch (e) {
          console.error('Failed to reorder tags:', e)
          onRefresh()
        } finally {
          setIsLoading(false)
        }
      }
    },
    [tagKategorien, tagKategorienSorted, tagsByKat, onRefresh]
  )

  const hasStructure = tagKategorien.length > 0

  return (
    <div className="relative">
      {!hasStructure ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Noch keine Tag-Kategorien geladen. Bitte Seite neu laden oder Migration prüfen.
        </p>
      ) : null}

      {hasStructure && tags.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Noch keine Tags vorhanden. Legen Sie über + einen Tag an – die Kategorien können per Ziehen sortiert
          werden.
        </p>
      )}

      {hasStructure && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-4">
            <SortableContext
              items={tagKategorienSorted.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {tagsByKat.map((kat) => (
                <SortableTagCategoryRow
                  key={kat.id}
                  kat={kat}
                  isCompact={!!draggingTagKatId}
                >
                  {kat.tags.length > 0 && (
                    <SortableContext items={kat.tags.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {kat.tags.map((tag) => (
                        <SortableTagRow
                          key={tag.id}
                          tag={tag}
                          onEdit={() => openEdit(tag)}
                          onDelete={() => handleDelete(tag.id)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </SortableTagCategoryRow>
              ))}
            </SortableContext>
          </div>
        </DndContext>
      )}

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/40" />
      )}

      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={openNew}
          disabled={!hasStructure}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>

      <ResponsiveModal
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingTag ? 'Tag bearbeiten' : 'Neuer Tag'}
        description={
          editingTag
            ? 'Ändern Sie die Details des Tags'
            : 'Erstellen Sie einen neuen Tag für die Packlisten-Generierung'
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="tag-kategorie">Kategorie *</Label>
            <Select
              value={form.tag_kategorie_id || defaultKategorieId}
              onValueChange={(v) => setForm({ ...form, tag_kategorie_id: v })}
            >
              <SelectTrigger id="tag-kategorie" className="mt-1">
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {tagKategorienSorted.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.titel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tag-titel">Titel *</Label>
            <Input
              id="tag-titel"
              value={form.titel}
              onChange={(e) => setForm({ ...form, titel: e.target.value })}
              placeholder="z.B. Sommer, Strand, Feuerküche"
            />
          </div>

          <div>
            <Label htmlFor="tag-farbe">Farbe</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {USER_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 ${
                    form.farbe === color.bg ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color.bg }}
                  onClick={() => setForm({ ...form, farbe: color.bg })}
                  title={color.label}
                />
              ))}
            </div>
            <Input
              id="tag-farbe"
              type="color"
              value={toColorInputValue(form.farbe)}
              onChange={(e) => setForm({ ...form, farbe: e.target.value })}
              className="mt-2 h-10"
            />
          </div>

          <div>
            <Label htmlFor="tag-icon">Icon (Emoji, optional)</Label>
            <Input
              id="tag-icon"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              placeholder="z.B. 🏖️, 🔥, ⛰️"
              maxLength={2}
            />
            <p className="text-xs text-muted-foreground mt-1">Ein einzelnes Emoji zur visuellen Darstellung</p>
          </div>

          <div>
            <Label htmlFor="tag-beschreibung">Beschreibung (optional)</Label>
            <Textarea
              id="tag-beschreibung"
              value={form.beschreibung}
              onChange={(e) => setForm({ ...form, beschreibung: e.target.value })}
              placeholder="Kurze Beschreibung des Tags..."
              rows={2}
            />
          </div>

          <Button onClick={editingTag ? handleUpdate : handleCreate} disabled={isLoading} className="w-full">
            {isLoading ? 'Wird gespeichert...' : editingTag ? 'Aktualisieren' : 'Erstellen'}
          </Button>
        </div>
      </ResponsiveModal>

      <ConfirmDialog
        open={!!deleteTagId}
        onOpenChange={(open) => !open && setDeleteTagId(null)}
        title="Tag löschen"
        description="Möchten Sie diesen Tag wirklich löschen? Er wird von allen Ausrüstungsgegenständen entfernt."
        onConfirm={executeDeleteTag}
        isLoading={isLoading}
      />
    </div>
  )
}
