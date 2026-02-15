import { useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Edit2, Trash2, Plus, User, Star } from 'lucide-react'
import { Mitreisender } from '@/lib/db'

interface TravelersManagerProps {
  travelers: Mitreisender[]
  onRefresh: () => void
}

export function TravelersManager({ travelers, onRefresh }: TravelersManagerProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [editingTraveler, setEditingTraveler] = useState<Mitreisender | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    userId: '',
    isDefaultMember: false
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
          isDefaultMember: form.isDefaultMember
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowDialog(false)
        setForm({ name: '', userId: '', isDefaultMember: false })
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
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
          isDefaultMember: form.isDefaultMember
        })
      })
      const data = await res.json()
      if (data.success) {
        setShowDialog(false)
        setEditingTraveler(null)
        setForm({ name: '', userId: '', isDefaultMember: false })
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update traveler:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diesen Mitreisenden wirklich löschen? Dies entfernt ihn auch von allen Urlauben und Ausrüstungsgegenständen.')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/mitreisende?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + data.error)
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
      isDefaultMember: traveler.is_default_member
    })
    setShowDialog(true)
  }

  const openNew = () => {
    setEditingTraveler(null)
    setForm({ name: '', userId: '', isDefaultMember: false })
    setShowDialog(true)
  }

  // Separate default and non-default travelers
  const defaultTravelers = travelers.filter(t => t.is_default_member)
  const otherTravelers = travelers.filter(t => !t.is_default_member)

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Mitreisende verwalten</h2>
          <p className="text-muted-foreground">
            Zentrale Verwaltung aller Mitreisenden. Standard-Mitreisende werden automatisch neuen Urlauben zugeordnet.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Mitreisender
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gesamt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{travelers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Standard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{defaultTravelers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weitere</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{otherTravelers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Default Travelers Section */}
      {defaultTravelers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Standard-Mitreisende
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Diese Mitreisenden werden automatisch bei neuen Urlauben ausgewählt
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {defaultTravelers.map((traveler) => (
                <div
                  key={traveler.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 bg-yellow-50 dark:bg-yellow-950/20"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{traveler.name}</p>
                      {traveler.user_id && (
                        <p className="text-xs text-muted-foreground">User-ID: {traveler.user_id}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(traveler)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(traveler.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Travelers Section */}
      <Card>
        <CardHeader>
          <CardTitle>Weitere Mitreisende</CardTitle>
          <p className="text-sm text-muted-foreground">
            Diese Mitreisenden können manuell zu Urlauben hinzugefügt werden
          </p>
        </CardHeader>
        <CardContent>
          {otherTravelers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine weiteren Mitreisenden vorhanden
            </p>
          ) : (
            <div className="space-y-2">
              {otherTravelers.map((traveler) => (
                <div
                  key={traveler.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{traveler.name}</p>
                      {traveler.user_id && (
                        <p className="text-xs text-muted-foreground">User-ID: {traveler.user_id}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(traveler)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(traveler.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <ResponsiveModal
        open={showDialog}
        onOpenChange={setShowDialog}
        title={editingTraveler ? 'Mitreisenden bearbeiten' : 'Neuer Mitreisender'}
        description={editingTraveler 
          ? 'Ändern Sie die Details des Mitreisenden' 
          : 'Erstellen Sie einen neuen Mitreisenden'}
      >
        <div className="space-y-4">
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
                  <Star className="h-4 w-4 text-yellow-500" />
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
    </div>
  )
}
