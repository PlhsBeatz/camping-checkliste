'use client'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { EquipmentTable } from '@/components/equipment-table'
import { Plus, Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { cn } from '@/lib/utils'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

export default function AusruestungPage() {
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [mitreisende, setMitreisende] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null)
  const [deleteEquipmentId, setDeleteEquipmentId] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    was: '',
    kategorie_id: '',
    transport_id: 'none',
    einzelgewicht: '',
    standard_anzahl: '1',
    status: 'Normal',
    details: '',
    is_standard: false,
    mitreisenden_typ: 'alle' as 'pauschal' | 'alle' | 'ausgewaehlte',
    tags: [] as string[],
    links: [] as { url: string }[],
    standard_mitreisende: [] as string[]
  })

  // Fetch Equipment Items
  useEffect(() => {
    const fetchEquipmentItems = async () => {
      try {
        const res = await fetch('/api/equipment-items')
        const data = (await res.json()) as ApiResponse<EquipmentItem[]>
        if (data.success && data.data) {
          setEquipmentItems(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch equipment items:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchEquipmentItems()
  }, [])
  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = (await res.json()) as ApiResponse<CategoryWithMain[]>
        if (data.success && data.data) {
          setCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [])

  // Fetch Main Categories
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const res = await fetch('/api/main-categories')
        const data = (await res.json()) as ApiResponse<MainCategory[]>
        if (data.success && data.data) {
          setMainCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch main categories:', error)
      }
    }
    fetchMainCategories()
  }, [])

  // Fetch Transport Vehicles
  useEffect(() => {
    const fetchTransportVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<TransportVehicle[]>
        if (data.success && data.data) {
          setTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
      }
    }
    fetchTransportVehicles()
  }, [])

  // Fetch Tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags')
        const data = (await res.json()) as ApiResponse<Tag[]>
        if (data.success && data.data) {
          setTags(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      }
    }
    fetchTags()
  }, [])

  // Fetch Mitreisende
  useEffect(() => {
    const fetchMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = (await res.json()) as ApiResponse<{ id: string; name: string }[]>
        if (data.success && data.data) {
          setMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
      }
    }
    fetchMitreisende()
  }, [])

  const resetForm = () => {
    setFormData({
      was: '',
      kategorie_id: '',
      transport_id: 'none',
      einzelgewicht: '',
      standard_anzahl: '1',
      status: 'Normal',
      details: '',
      is_standard: false,
      mitreisenden_typ: 'alle',
      tags: [],
      links: [],
      standard_mitreisende: []
    })
  }

  const handleAddEquipment = () => {
    resetForm()
    setShowAddDialog(true)
  }

  const handleEditEquipment = (item: EquipmentItem) => {
    setEditingItem(item)
    setFormData({
      was: item.was,
      kategorie_id: item.kategorie_id,
      transport_id: item.transport_id || 'none',
      einzelgewicht: item.einzelgewicht ? String(item.einzelgewicht) : '',
      standard_anzahl: String(item.standard_anzahl),
      status: item.status,
      details: item.details || '',
      is_standard: item.is_standard || false,
      mitreisenden_typ: item.mitreisenden_typ || 'alle',
      tags: item.tags?.map(t => typeof t === 'object' ? t.id : t) || [],
      links: item.links || [],
      standard_mitreisende: item.standard_mitreisende || []
    })
    setShowEditDialog(true)
  }

  const handleSaveEquipment = async () => {
    if (!formData.was || !formData.kategorie_id) {
      alert('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        was: formData.was,
        kategorie_id: formData.kategorie_id,
        transport_id: formData.transport_id === 'none' ? null : formData.transport_id || null,
        einzelgewicht: formData.einzelgewicht ? parseFloat(formData.einzelgewicht.replace(',', '.')) : null,
        standard_anzahl: parseInt(formData.standard_anzahl) || 1,
        status: formData.status,
        details: formData.details || null,
        is_standard: formData.is_standard,
        mitreisenden_typ: formData.mitreisenden_typ,
        standard_mitreisende: formData.standard_mitreisende,
        tags: formData.tags,
        links: formData.links.filter(link => link.url.trim() !== '').map(link => link.url)
      }

      const res = await fetch('/api/equipment-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<EquipmentItem>
      
      if (data.success) {
        setShowAddDialog(false)
        resetForm()
        const itemsRes = await fetch('/api/equipment-items')
        const itemsData = (await itemsRes.json()) as ApiResponse<EquipmentItem[]>
        if (itemsData.success && itemsData.data) {
          setEquipmentItems(itemsData.data)
        }
      } else {
        alert('Fehler beim Speichern: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to save equipment:', error)
      alert('Fehler beim Speichern')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateEquipment = async () => {
    if (!editingItem || !formData.was || !formData.kategorie_id) {
      alert('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        id: editingItem.id,
        was: formData.was,
        kategorie_id: formData.kategorie_id,
        transport_id: formData.transport_id === 'none' ? null : formData.transport_id || null,
        einzelgewicht: formData.einzelgewicht ? parseFloat(formData.einzelgewicht.replace(',', '.')) : null,
        standard_anzahl: parseInt(formData.standard_anzahl) || 1,
        status: formData.status,
        details: formData.details || null,
        is_standard: formData.is_standard,
        mitreisenden_typ: formData.mitreisenden_typ,
        standard_mitreisende: formData.standard_mitreisende,
        tags: formData.tags,
        links: formData.links.filter(link => link.url.trim() !== '').map(link => link.url)
      }

      const res = await fetch('/api/equipment-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<EquipmentItem>
      
      if (data.success) {
        setShowEditDialog(false)
        setEditingItem(null)
        resetForm()
        const itemsRes = await fetch('/api/equipment-items')
        const itemsData = (await itemsRes.json()) as ApiResponse<EquipmentItem[]>
        if (itemsData.success && itemsData.data) {
          setEquipmentItems(itemsData.data)
        }
      } else {
        alert('Fehler beim Aktualisieren: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update equipment:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEquipment = (equipmentId: string) => {
    setDeleteEquipmentId(equipmentId)
  }

  const executeDeleteEquipment = async () => {
    if (!deleteEquipmentId) return
    const equipmentId = deleteEquipmentId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/equipment-items?id=${equipmentId}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<boolean>
      if (data.success) {
        setEquipmentItems(equipmentItems.filter(item => item.id !== equipmentId))
      } else {
        alert('Fehler beim Löschen des Gegenstands: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error)
      alert('Fehler beim Löschen des Gegenstands')
    } finally {
      setIsLoading(false)
    }
  }

  const addLinkField = () => {
    setFormData({
      ...formData,
      links: [...formData.links, { url: '' }]
    })
  }

  const removeLinkField = (index: number) => {
    const newLinks = formData.links.filter((_, i) => i !== index)
    setFormData({ ...formData, links: newLinks })
  }

  const updateLinkField = (index: number, value: string) => {
    const newLinks = [...formData.links]
    newLinks[index] = { url: value }
    setFormData({ ...formData, links: newLinks })
  }

  return (
    <div className="min-h-screen bg-[rgb(250,250,249)] flex">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area - auf Mobile: volle Viewport-Höhe, Flex-Layout für dynamische Tabellenhöhe */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300",
        "lg:ml-[280px]",
        "max-md:h-dvh max-md:min-h-dvh"
      )}>
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6 overflow-hidden">
          {/* Header - fixe Höhe */}
          <div className="flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[rgb(45,79,30)]">
                  Ausrüstung
                </h1>
              </div>
            </div>
          </div>

          {/* Equipment Table - füllt verbleibende Höhe auf Mobile, dynamische Höhe */}
          <div className="flex-1 min-h-0 min-w-0 mt-4 md:mt-6 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent"></div>
                  <p className="text-muted-foreground animate-pulse">Ausrüstung wird geladen...</p>
                </div>
              ) : (
                <EquipmentTable
                  equipmentItems={equipmentItems}
                  categories={categories}
                  mainCategories={mainCategories}
                  transportVehicles={transportVehicles}
                  tags={tags}
                  onEdit={handleEditEquipment}
                  onDelete={handleDeleteEquipment}
                  dynamicHeight
                />
              )}
          </div>

          {/* FAB: Neuer Gegenstand - Kreisrund mit Plus (wie bei Packliste) */}
          <div className="fixed bottom-6 right-6 z-30">
            <Button
              size="icon"
              onClick={handleAddEquipment}
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>

      {/* Add Equipment Dialog */}
      <ResponsiveModal
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        title="Neuen Gegenstand hinzufügen"
        description="Fügen Sie einen neuen Ausrüstungsgegenstand hinzu"
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-4">
            <div>
              <Label htmlFor="was">Was *</Label>
              <Input
                id="was"
                value={formData.was}
                onChange={(e) => setFormData({ ...formData, was: e.target.value })}
                placeholder="z.B. Zelt, Schlafsack..."
              />
            </div>

            <div>
              <Label htmlFor="kategorie">Kategorie *</Label>
              <Select value={formData.kategorie_id} onValueChange={(value) => setFormData({ ...formData, kategorie_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.hauptkategorie_titel} - {cat.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gewicht">Gewicht (kg)</Label>
                <Input
                  id="gewicht"
                  value={formData.einzelgewicht}
                  onChange={(e) => setFormData({ ...formData, einzelgewicht: e.target.value })}
                  placeholder="z.B. 0,234"
                />
              </div>

              <div>
                <Label htmlFor="anzahl">Standard-Anzahl</Label>
                <Input
                  id="anzahl"
                  type="number"
                  min="1"
                  value={formData.standard_anzahl}
                  onChange={(e) => setFormData({ ...formData, standard_anzahl: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="transport">Transport</Label>
                <Select value={formData.transport_id} onValueChange={(value) => setFormData({ ...formData, transport_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Transport</SelectItem>
                    {transportVehicles.map(tv => (
                      <SelectItem key={tv.id} value={tv.id}>
                        {tv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Immer gepackt">Immer gepackt</SelectItem>
                    <SelectItem value="Fest Installiert">Fest Installiert</SelectItem>
                    <SelectItem value="Ausgemustert">Ausgemustert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="mitreisenden_typ">Gepackt für</Label>
                  <Select value={formData.mitreisenden_typ} onValueChange={(value: 'pauschal' | 'alle' | 'ausgewaehlte') => setFormData({ ...formData, mitreisenden_typ: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">👥 Alle</SelectItem>
                      <SelectItem value="pauschal">📦 Pauschal</SelectItem>
                      <SelectItem value="ausgewaehlte">👤 Individuell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.mitreisenden_typ === 'ausgewaehlte' && (
                  <div>
                    <Label>Mitreisende</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {mitreisende.map(m => (
                        <label key={m.id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80">
                          <input
                            type="checkbox"
                            checked={formData.standard_mitreisende.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, standard_mitreisende: [...formData.standard_mitreisende, m.id] })
                              } else {
                                setFormData({ ...formData, standard_mitreisende: formData.standard_mitreisende.filter(id => id !== m.id) })
                              }
                            }}
                            className="h-3 w-3"
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <label key={tag.id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80">
                      <input
                        type="checkbox"
                        checked={formData.tags.includes(tag.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, tags: [...formData.tags, tag.id] })
                          } else {
                            setFormData({ ...formData, tags: formData.tags.filter(id => id !== tag.id) })
                          }
                        }}
                        className="h-3 w-3"
                      />
                      {tag.titel}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="details">Details</Label>
              <Textarea
                id="details"
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="Zusätzliche Informationen..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_standard"
                checked={formData.is_standard}
                onChange={(e) => setFormData({ ...formData, is_standard: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_standard" className="cursor-pointer">
                Als Standard markieren (⭐)
              </Label>
            </div>

            <div>
              <Label>Links</Label>
              {formData.links.map((link, idx) => (
                <div key={idx} className="flex gap-2 mt-2">
                  <Input
                    value={link.url}
                    onChange={(e) => updateLinkField(idx, e.target.value)}
                    placeholder="https://..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLinkField(idx)}
                  >
                    Entfernen
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLinkField}
                className="mt-2"
              >
                Link hinzufügen
              </Button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSaveEquipment} disabled={isSaving} className="flex-1">
                {isSaving ? 'Speichert...' : 'Speichern'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving}>
                Abbrechen
              </Button>
            </div>
          </div>
      </ResponsiveModal>

      {/* Gegenstand löschen – Bestätigung */}
      <ConfirmDialog
        open={!!deleteEquipmentId}
        onOpenChange={(open) => !open && setDeleteEquipmentId(null)}
        title="Gegenstand löschen"
        description="Sind Sie sicher, dass Sie diesen Gegenstand löschen möchten?"
        onConfirm={executeDeleteEquipment}
        isLoading={isLoading}
      />

      {/* Edit Equipment Dialog */}
      <ResponsiveModal
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        title="Gegenstand bearbeiten"
        description="Bearbeiten Sie die Details des Ausrüstungsgegenstands"
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-4">
            <div>
              <Label htmlFor="edit-was">Was *</Label>
              <Input
                id="edit-was"
                value={formData.was}
                onChange={(e) => setFormData({ ...formData, was: e.target.value })}
                placeholder="z.B. Zelt, Schlafsack..."
              />
            </div>

            <div>
              <Label htmlFor="edit-kategorie">Kategorie *</Label>
              <Select value={formData.kategorie_id} onValueChange={(value) => setFormData({ ...formData, kategorie_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.hauptkategorie_titel} - {cat.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-gewicht">Gewicht (kg)</Label>
                <Input
                  id="edit-gewicht"
                  value={formData.einzelgewicht}
                  onChange={(e) => setFormData({ ...formData, einzelgewicht: e.target.value })}
                  placeholder="z.B. 0,234"
                />
              </div>

              <div>
                <Label htmlFor="edit-anzahl">Standard-Anzahl</Label>
                <Input
                  id="edit-anzahl"
                  type="number"
                  min="1"
                  value={formData.standard_anzahl}
                  onChange={(e) => setFormData({ ...formData, standard_anzahl: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-transport">Transport</Label>
                <Select value={formData.transport_id} onValueChange={(value) => setFormData({ ...formData, transport_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kein Transport" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Transport</SelectItem>
                    {transportVehicles.map(tv => (
                      <SelectItem key={tv.id} value={tv.id}>
                        {tv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Immer gepackt">Immer gepackt</SelectItem>
                    <SelectItem value="Fest Installiert">Fest Installiert</SelectItem>
                    <SelectItem value="Ausgemustert">Ausgemustert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-mitreisenden_typ">Gepackt für</Label>
                  <Select value={formData.mitreisenden_typ} onValueChange={(value: 'pauschal' | 'alle' | 'ausgewaehlte') => setFormData({ ...formData, mitreisenden_typ: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">👥 Alle</SelectItem>
                      <SelectItem value="pauschal">📦 Pauschal</SelectItem>
                      <SelectItem value="ausgewaehlte">👤 Individuell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.mitreisenden_typ === 'ausgewaehlte' && (
                  <div>
                    <Label>Mitreisende</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {mitreisende.map(m => (
                        <label key={m.id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80">
                          <input
                            type="checkbox"
                            checked={formData.standard_mitreisende.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, standard_mitreisende: [...formData.standard_mitreisende, m.id] })
                              } else {
                                setFormData({ ...formData, standard_mitreisende: formData.standard_mitreisende.filter(id => id !== m.id) })
                              }
                            }}
                            className="h-3 w-3"
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <label key={tag.id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80">
                      <input
                        type="checkbox"
                        checked={formData.tags.includes(tag.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, tags: [...formData.tags, tag.id] })
                          } else {
                            setFormData({ ...formData, tags: formData.tags.filter(id => id !== tag.id) })
                          }
                        }}
                        className="h-3 w-3"
                      />
                      {tag.titel}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-details">Details</Label>
              <Textarea
                id="edit-details"
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="Zusätzliche Informationen..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit_is_standard"
                checked={formData.is_standard}
                onChange={(e) => setFormData({ ...formData, is_standard: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit_is_standard" className="cursor-pointer">
                Als Standard markieren (⭐)
              </Label>
            </div>

            <div>
              <Label>Links</Label>
              {formData.links.map((link, idx) => (
                <div key={idx} className="flex gap-2 mt-2">
                  <Input
                    value={link.url}
                    onChange={(e) => updateLinkField(idx, e.target.value)}
                    placeholder="https://..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeLinkField(idx)}
                  >
                    Entfernen
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLinkField}
                className="mt-2"
              >
                Link hinzufügen
              </Button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleUpdateEquipment} disabled={isSaving} className="flex-1">
                {isSaving ? 'Speichert...' : 'Aktualisieren'}
              </Button>
              <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
                Abbrechen
              </Button>
            </div>
          </div>
      </ResponsiveModal>
    </div>
  )
}
