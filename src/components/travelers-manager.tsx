import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus, Star, MoreVertical, Pencil, Mail, Copy } from 'lucide-react'
import { Mitreisender } from '@/lib/db'
import { useAuth } from '@/components/auth-provider'
import type { ApiResponse } from '@/lib/api-types'
import { USER_COLORS, DEFAULT_USER_COLOR_BG } from '@/lib/user-colors'
import { getInitials } from '@/lib/utils'

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
  initials,
  index,
  onEdit,
  onDelete,
  onInvite,
}: {
  traveler: Mitreisender
  initials: string
  index: number
  onEdit: (t: Mitreisender) => void
  onDelete: (id: string) => void
  onInvite: (t: Mitreisender) => void
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
          {initials}
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
          {!traveler.user_id && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                onInvite(traveler)
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Einladung erstellen
            </DropdownMenuItem>
          )}
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
  const { canAccessConfig } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [editingTraveler, setEditingTraveler] = useState<Mitreisender | null>(null)
  const [deleteTravelerId, setDeleteTravelerId] = useState<string | null>(null)
  const [inviteTraveler, setInviteTraveler] = useState<Mitreisender | null>(null)
  const [inviteRole, setInviteRole] = useState<'admin' | 'kind' | 'gast'>('kind')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteBerechtigungen, setInviteBerechtigungen] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    userId: '',
    isDefaultMember: false,
    farbe: DEFAULT_USER_COLOR_BG
  })
  const [formBerechtigungen, setFormBerechtigungen] = useState<string[]>([])
  const [formUserRole, setFormUserRole] = useState<'admin' | 'kind' | 'gast' | ''>('')

  const BERECHTIGUNGEN_OPTIONS = [
    { key: 'can_edit_pauschal_entries', label: 'Pauschale Einträge bearbeiten' },
    { key: 'gepackt_erfordert_elternkontrolle', label: 'Gepackt erfordert Elternkontrolle' },
  ] as const

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
      if (!data.success) {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
        return
      }
      if (editingTraveler.user_id && formUserRole && formUserRole !== editingTraveler.user_role) {
        const roleRes = await fetch(`/api/users/${editingTraveler.user_id}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: formUserRole })
        })
        const roleData = (await roleRes.json()) as ApiResponse<unknown>
        if (!roleData.success) {
          alert('Mitreisender aktualisiert, aber Benutzer-Rolle konnte nicht geändert werden.')
        }
      }
      if (editingTraveler.user_id && editingTraveler.user_role === 'kind') {
        const permRes = await fetch(`/api/mitreisende/${editingTraveler.id}/berechtigungen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ berechtigungen: formBerechtigungen })
        })
        const permData = (await permRes.json()) as ApiResponse<unknown>
        if (!permData.success) {
          alert('Mitreisender aktualisiert, aber Berechtigungen konnten nicht gespeichert werden.')
        }
      }
      setShowDialog(false)
      setEditingTraveler(null)
      setForm({ name: '', userId: '', isDefaultMember: false, farbe: DEFAULT_USER_COLOR_BG })
      setFormBerechtigungen([])
      setFormUserRole('')
      onRefresh()
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
    setFormUserRole(traveler.user_role || '')
    setFormBerechtigungen([])
    setShowDialog(true)
  }

  useEffect(() => {
    if (!editingTraveler) {
      setFormBerechtigungen([])
      setFormUserRole('')
      return
    }
    setFormUserRole(editingTraveler.user_role || '')
    const fetchBerechtigungen = async () => {
      try {
        const res = await fetch(`/api/mitreisende/${editingTraveler.id}/berechtigungen`)
        const data = (await res.json()) as { success?: boolean; data?: string[] }
        if (data.success && Array.isArray(data.data)) {
          setFormBerechtigungen(data.data)
        }
      } catch {
        // ignore
      }
    }
    fetchBerechtigungen()
  }, [editingTraveler])

  const openNew = () => {
    setEditingTraveler(null)
    setForm({ name: '', userId: '', isDefaultMember: false, farbe: DEFAULT_USER_COLOR_BG })
    setShowDialog(true)
  }

  const openInvite = (traveler: Mitreisender) => {
    setInviteTraveler(traveler)
    setInviteRole('kind')
    setInviteLink(null)
    setInviteBerechtigungen([])
  }

  const handleAssignMe = async () => {
    if (!editingTraveler || editingTraveler.user_id) return
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/assign-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitreisenderId: editingTraveler.id })
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (data.success) {
        onRefresh()
        setShowDialog(false)
        setEditingTraveler(null)
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to assign me:', error)
      alert('Fehler bei der Zuordnung')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateInvite = async () => {
    if (!inviteTraveler) return
    setIsLoading(true)
    try {
      if (inviteRole === 'kind') {
        const permRes = await fetch(`/api/mitreisende/${inviteTraveler.id}/berechtigungen`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ berechtigungen: inviteBerechtigungen })
        })
        const permData = (await permRes.json()) as { success?: boolean }
        if (!permData.success) {
          alert('Berechtigungen konnten nicht gespeichert werden.')
          return
        }
      }
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitreisenderId: inviteTraveler.id, role: inviteRole })
      })
      const data = (await res.json()) as { success?: boolean; link?: string; error?: string }
      if (data.success && data.link) {
        setInviteLink(data.link)
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create invite:', error)
      alert('Fehler beim Erstellen der Einladung')
    } finally {
      setIsLoading(false)
    }
  }

  const copyInviteLink = () => {
    if (inviteLink && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink)
      alert('Link kopiert!')
    }
  }

  // Separate default and non-default travelers
  const defaultTravelers = travelers.filter(t => t.is_default_member)
  const otherTravelers = travelers.filter(t => !t.is_default_member)
  const travelerNames = travelers.map((t) => t.name)
  const getTravelerInitials = (name: string) => getInitials(name, travelerNames)

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
                initials={getTravelerInitials(traveler.name)}
                index={idx}
                onEdit={openEdit}
                onDelete={handleDelete}
                onInvite={openInvite}
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
                initials={getTravelerInitials(traveler.name)}
                index={defaultTravelers.length + idx}
                onEdit={openEdit}
                onDelete={handleDelete}
                onInvite={openInvite}
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
            {editingTraveler && !editingTraveler.user_id && canAccessConfig && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Benutzer zuordnen</Label>
                <p className="text-xs text-muted-foreground">
                  Ordnen Sie sich als Admin diesem Mitreisenden zu, um Ihr Profil mit der Packliste zu verknüpfen.
                </p>
                <Button variant="outline" onClick={handleAssignMe} disabled={isLoading}>
                  Mich diesem Mitreisenden zuordnen
                </Button>
              </div>
            )}
            {editingTraveler?.user_id && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Benutzer-Rolle</Label>
                <p className="text-xs text-muted-foreground">
                  Die Rolle des zugeordneten Benutzers. Wird beim Speichern übernommen.
                </p>
                <Select
                  value={formUserRole}
                  onValueChange={(v) => setFormUserRole(v as 'admin' | 'kind' | 'gast')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="kind">Kind</SelectItem>
                    <SelectItem value="gast">Gast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
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
            {editingTraveler?.user_id && editingTraveler?.user_role === 'kind' && (
              <div className="space-y-3 pt-2 border-t">
                <Label>Berechtigungen (für Kind)</Label>
                <p className="text-xs text-muted-foreground">
                  Diese Einstellungen gelten, wenn der Mitreisende als Kind eingeladen wurde.
                </p>
                <div className="space-y-2">
                  {BERECHTIGUNGEN_OPTIONS.map((opt) => (
                    <div key={opt.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`perm-${opt.key}`}
                        checked={formBerechtigungen.includes(opt.key)}
                        onCheckedChange={(checked) => {
                          setFormBerechtigungen(prev =>
                            checked
                              ? [...prev, opt.key]
                              : prev.filter((k) => k !== opt.key)
                          )
                        }}
                      />
                      <label
                        htmlFor={`perm-${opt.key}`}
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        {opt.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={editingTraveler ? handleUpdate : handleCreate}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingTraveler ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Einladung erstellen Modal */}
      <ResponsiveModal
        open={!!inviteTraveler}
        onOpenChange={(open) => !open && setInviteTraveler(null)}
        title="Einladung erstellen"
        description={`Einladungslink für ${inviteTraveler?.name ?? ''} erstellen`}
        contentClassName="max-w-lg"
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          {!inviteLink ? (
            <>
              <div>
                <Label>Rolle</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'admin' | 'kind' | 'gast')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="kind">Kind</SelectItem>
                    <SelectItem value="gast">Gast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteRole === 'kind' && (
                <div className="space-y-3 pt-2 border-t">
                  <Label>Berechtigungen (für Kind)</Label>
                  <p className="text-xs text-muted-foreground">
                    Diese Einstellungen gelten, sobald die Einladung angenommen wurde.
                  </p>
                  <div className="space-y-2">
                    {BERECHTIGUNGEN_OPTIONS.map((opt) => (
                      <div key={opt.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={`invite-perm-${opt.key}`}
                          checked={inviteBerechtigungen.includes(opt.key)}
                          onCheckedChange={(checked) => {
                            setInviteBerechtigungen(prev =>
                              checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key)
                            )
                          }}
                        />
                        <label htmlFor={`invite-perm-${opt.key}`} className="text-sm font-medium leading-none cursor-pointer">
                          {opt.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={handleCreateInvite} disabled={isLoading} className="w-full">
                {isLoading ? 'Wird erstellt...' : 'Einladung erstellen'}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Teilen Sie diesen Link mit {inviteTraveler?.name}. Der Link ist zeitlich begrenzt gültig.
              </p>
              <div className="flex gap-2">
                <Input value={inviteLink} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyInviteLink} title="Link kopieren">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="secondary" onClick={() => setInviteTraveler(null)} className="w-full">
                Schließen
              </Button>
            </>
          )}
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
