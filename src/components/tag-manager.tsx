import { useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Pencil, Plus, Trash2, Tag as TagIcon } from 'lucide-react'
import { Tag } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'

interface TagManagerProps {
  tags: Tag[]
  onRefresh: () => void
}

const PRESET_COLORS = [
  { name: 'Blau', value: '#3b82f6' },
  { name: 'Grün', value: '#10b981' },
  { name: 'Gelb', value: '#f59e0b' },
  { name: 'Rot', value: '#ef4444' },
  { name: 'Lila', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Türkis', value: '#06b6d4' },
]

export function TagManager({ tags, onRefresh }: TagManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    titel: '',
    farbe: '#3b82f6',
    icon: '',
    beschreibung: ''
  })

  const handleCreate = async () => {
    if (!form.titel.trim()) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: form.titel,
          farbe: form.farbe,
          icon: form.icon || null,
          beschreibung: form.beschreibung || null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setForm({ titel: '', farbe: '#3b82f6', icon: '', beschreibung: '' })
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
    if (!editingTag || !form.titel.trim()) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTag.id,
          titel: form.titel,
          farbe: form.farbe,
          icon: form.icon || null,
          beschreibung: form.beschreibung || null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setEditingTag(null)
        setForm({ titel: '', farbe: '#3b82f6', icon: '', beschreibung: '' })
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
        method: 'DELETE'
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
      farbe: tag.farbe || '#3b82f6',
      icon: tag.icon || '',
      beschreibung: tag.beschreibung || ''
    })
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingTag(null)
    setForm({ titel: '', farbe: '#3b82f6', icon: '', beschreibung: '' })
    setShowDialog(true)
  }

  return (
    <div className="relative">
      {/* Tags Grid - direkt im übergeordneten Container */}
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Noch keine Tags vorhanden. Erstellen Sie Ihren ersten Tag!
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              style={{ borderLeftWidth: '4px', borderLeftColor: tag.farbe || '#3b82f6' }}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tag.farbe || '#3b82f6' }}
                >
                  {tag.icon ? (
                    <span className="text-white text-sm">{tag.icon}</span>
                  ) : (
                    <TagIcon className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{tag.titel}</p>
                  {tag.beschreibung && (
                    <p className="text-xs text-muted-foreground truncate">{tag.beschreibung}</p>
                  )}
                </div>
              </div>
              <div className="ml-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 min-w-7 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        openEdit(tag)
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault()
                        handleDelete(tag.id)
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB: Neuer Tag - wie auf Ausrüstungsseite */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={openNew}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>

      {/* Create/Edit Dialog */}
      <ResponsiveModal
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingTag ? 'Tag bearbeiten' : 'Neuer Tag'}
        description={editingTag 
          ? 'Ändern Sie die Details des Tags' 
          : 'Erstellen Sie einen neuen Tag für die Packlisten-Generierung'}
      >
        <div className="space-y-4">
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
              <div className="flex gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${
                      form.farbe === color.value ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setForm({ ...form, farbe: color.value })}
                    title={color.name}
                  />
                ))}
              </div>
              <Input
                id="tag-farbe"
                type="color"
                value={form.farbe}
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
              <p className="text-xs text-muted-foreground mt-1">
                Ein einzelnes Emoji zur visuellen Darstellung
              </p>
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

            <Button
              onClick={editingTag ? handleUpdate : handleCreate}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingTag ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Tag löschen – Bestätigung */}
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
