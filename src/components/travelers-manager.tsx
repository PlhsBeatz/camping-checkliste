import { useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Trash2, Plus, Star, MoreVertical, Pencil } from 'lucide-react'
import { Mitreisender } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { USER_COLORS, DEFAULT_USER_COLOR_BG } from '@/lib/user-colors'

const getInitials = (name: string) => {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const getAvatarColor = (index: number, customColor?: string | null) => {
  if (customColor) {
    const preset = USER_COLORS.find((c) => c.bg === customColor)
    return { backgroundColor: customColor, color: preset?.fg ?? '#ffffff' }
  }
  const c = USER_COLORS[index % USER_COLORS.length]!
  return { backgroundColor: c.bg, color: c.fg }
}

function TravelerRow({
  traveler,
  index,
  onEdit,
  onDelete,
}: {
  traveler: Mitreisender
  index: number
  onEdit: (t: Mitreisender) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 bg-white"
    >
      <div className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={getAvatarColor(index, traveler.farbe)}
        >
          {getInitials(traveler.name)}
        </div>
        <div>
          <p className="font-medium">{traveler.name}</p>
          {traveler.user_id && (
            <p className="text-xs text-muted-foreground">User-ID: {traveler.user_id}</p>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onEdit(traveler)
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              onDelete(traveler.id)
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

interface TravelersManagerProps {
  travelers: Mitreisender[]
  onRefresh: () => void
}

export function TravelersManager({ travelers, onRefresh }: TravelersManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingTraveler, setEditingTraveler] = useState<Mitreisender | null>(null)
  const [deleteTravelerId, setDeleteTravelerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    userId: '',
    isDefaultMember: false,
    farbe: DEFAULT_USER_COLOR_BG
  })

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/mitreisende', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          userId: form.userId || null,
          isDefaultMember: form.isDefaultMember,
          farbe: form.farbe || null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setForm({ name: '', userId: '', isDefaultMember: false, farbe: DEFAULT_USER_COLOR_BG })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create traveler:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingTraveler || !form.name.trim()) {
      alert('Bitte geben Sie einen Namen ein')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/mitreisende', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTraveler.id,
          name: form.name,
          userId: form.userId || null,
          isDefaultMember: form.isDefaultMember,
          farbe: form.farbe || null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowDialog(false)
        setEditingTraveler(null)
        setForm({ name: '', userId: '', isDefaultMember: false, farbe: DEFAULT_USER_COLOR_BG })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update traveler:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    setDeleteTravelerId(id)
  }

  const executeDeleteTraveler = async () => {
    if (!deleteTravelerId) return
    const id = deleteTravelerId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/mitreisende?id=${id}`, {
        method: 'DELETE'
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete traveler:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const openEdit = (traveler: Mitreisender) => {
    setEditingTraveler(traveler)
    setForm({
      name: traveler.name,
      userId: traveler.user_id || '',
      isDefaultMember: traveler.is_default_member,
      farbe: traveler.farbe || DEFAULT_USER_COLOR_BG
    })
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingTraveler(null)
    setForm({ name: '', userId: '', isDefaultMember: false, farbe: DEFAULT_USER_COLOR_BG })
    setShowDialog(true)
  }

  // Separate default and non-default travelers
  const defaultTravelers = travelers.filter(t => t.is_default_member)
  const otherTravelers = travelers.filter(t => !t.is_default_member)

  return (
    <div className="space-y-6">
      {/* Standard-Mitreisende Section */}
      {defaultTravelers.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Star className="h-4 w-4" style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }} />
            Standard-Mitreisende
          </h3>
          <p className="text-sm text-muted-foreground">
            Diese Mitreisenden werden automatisch bei neuen Urlauben ausgewählt
          </p>
          <div className="space-y-2">
            {defaultTravelers.map((traveler, idx) => (
              <TravelerRow
                key={traveler.id}
                traveler={traveler}
                index={idx}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Weitere Mitreisende Section */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold">Weitere Mitreisende</h3>
        <p className="text-sm text-muted-foreground">
          Diese Mitreisenden können manuell zu Urlauben hinzugefügt werden
        </p>
        {otherTravelers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg">
            Keine weiteren Mitreisenden vorhanden
          </p>
        ) : (
          <div className="space-y-2">
            {otherTravelers.map((traveler, idx) => (
              <TravelerRow
                key={traveler.id}
                traveler={traveler}
                index={defaultTravelers.length + idx}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB: Neuer Mitreisender - wie auf Ausrüstungsseite */}
      <div className="fixed bottom-6 right-6 z-30">
        <Button
          size="icon"
          onClick={openNew}
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Button>
      </div>

      {/* Create/Edit Dialog – Padding wie Packliste/Ausrüstung (px-6) */}
      <ResponsiveModal
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingTraveler ? 'Mitreisenden bearbeiten' : 'Neuer Mitreisender'}
        description={editingTraveler 
          ? 'Ändern Sie die Details des Mitreisenden' 
          : 'Erstellen Sie einen neuen Mitreisenden'}
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
            <div>
              <Label htmlFor="traveler-name">Name *</Label>
              <Input
                id="traveler-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Max Mustermann"
              />
            </div>
            <div>
              <Label htmlFor="traveler-userid">User-ID (optional)</Label>
              <Input
                id="traveler-userid"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
                placeholder="Für zukünftige Login-Funktion"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dieses Feld wird für die zukünftige Benutzer-Authentifizierung verwendet
              </p>
            </div>
            <div>
              <Label htmlFor="traveler-farbe">Farbe</Label>
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
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-default"
                checked={form.isDefaultMember}
                onCheckedChange={(checked) => setForm({ ...form, isDefaultMember: checked as boolean })}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="is-default"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                >
                  <Star className="h-4 w-4" style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }} />
                  Als Standard markieren
                </label>
                <p className="text-xs text-muted-foreground">
                  Standard-Mitreisende werden automatisch bei neuen Urlauben ausgewählt
                </p>
              </div>
            </div>
            <Button
              onClick={editingTraveler ? handleUpdate : handleCreate}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingTraveler ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Mitreisender löschen – Bestätigung */}
      <ConfirmDialog
        open={!!deleteTravelerId}
        onOpenChange={(open) => !open && setDeleteTravelerId(null)}
        title="Mitreisenden löschen"
        description="Möchten Sie diesen Mitreisenden wirklich löschen? Dies entfernt ihn auch von allen Urlauben und Ausrüstungsgegenständen."
        onConfirm={executeDeleteTraveler}
        isLoading={isLoading}
      />
    </div>
  )
}
