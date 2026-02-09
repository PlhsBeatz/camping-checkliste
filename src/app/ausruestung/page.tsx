'use client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { EquipmentTable } from '@/components/equipment-table'
import { Plus, Menu } from 'lucide-react'
import { useState, useEffect } from 'react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag } from '@/lib/db'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    was: '',
    kategorie_id: '',
    transport_id: '',
    einzelgewicht: '',
    standard_anzahl: '1',
    status: 'Optional',
    details: '',
    is_standard: false,
    links: [] as { url: string }[]
  })

  // Load equipment items
  useEffect(() => {
    const fetchEquipmentItems = async () => {
      try {
        const res = await fetch('/api/equipment-items')
        const data = await res.json()
        if (data.success) {
          setEquipmentItems(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch equipment items:', error)
      }
    }
    fetchEquipmentItems()
  }, [])

  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = await res.json()
        if (data.success) {
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
        const data = await res.json()
        if (data.success) {
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
        const data = await res.json()
        if (data.success) {
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
        const data = await res.json()
        if (data.success) {
          setTags(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTags()
  }, [])

  const resetForm = () => {
    setFormData({
      was: '',
      kategorie_id: '',
      transport_id: '',
      einzelgewicht: '',
      standard_anzahl: '1',
      status: 'Optional',
      details: '',
      is_standard: false,
      links: []
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
      transport_id: item.transport_id || '',
      einzelgewicht: item.einzelgewicht ? String(item.einzelgewicht) : '',
      standard_anzahl: String(item.standard_anzahl),
      status: item.status,
      details: item.details || '',
      is_standard: item.is_standard || false,
      links: item.links || []
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
        transport_id: formData.transport_id || null,
        einzelgewicht: formData.einzelgewicht ? parseInt(formData.einzelgewicht) : null,
        standard_anzahl: parseInt(formData.standard_anzahl) || 1,
        status: formData.status,
        details: formData.details || null,
        is_standard: formData.is_standard,
        links: formData.links.filter(link => link.url.trim() !== '')
      }

      const res = await fetch('/api/equipment-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      
      if (data.success) {
        // Refresh equipment items
        const itemsRes = await fetch('/api/equipment-items')
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setEquipmentItems(itemsData.data)
        }
        setShowAddDialog(false)
        resetForm()
      } else {
        alert('Fehler beim Speichern: ' + data.error)
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
        transport_id: formData.transport_id || null,
        einzelgewicht: formData.einzelgewicht ? parseInt(formData.einzelgewicht) : null,
        standard_anzahl: parseInt(formData.standard_anzahl) || 1,
        status: formData.status,
        details: formData.details || null,
        is_standard: formData.is_standard,
        links: formData.links.filter(link => link.url.trim() !== '')
      }

      const res = await fetch('/api/equipment-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      
      if (data.success) {
        // Refresh equipment items
        const itemsRes = await fetch('/api/equipment-items')
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setEquipmentItems(itemsData.data)
        }
        setShowEditDialog(false)
        setEditingItem(null)
        resetForm()
      } else {
        alert('Fehler beim Aktualisieren: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update equipment:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Gegenstand löschen möchten?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/equipment-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: equipmentId }),
      })
      const data = await res.json()
      if (data.success) {
        setEquipmentItems(equipmentItems.filter(item => item.id !== equipmentId))
      } else {
        alert('Fehler beim Löschen des Gegenstands: ' + data.error)
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

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        "lg:ml-[280px]"
      )}>
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
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
                <h1 className="text-3xl font-bold tracking-tight">
                  Ausrüstung
                </h1>
                <p className="text-muted-foreground mt-1">
                  Verwalten Sie Ihre Camping-Ausrüstung
                </p>
              </div>
            </div>

            {/* Add Equipment Button */}
            <Button 
              size="lg"
              onClick={handleAddEquipment}
              className="bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Neuer Gegenstand
            </Button>
          </div>

          {/* Equipment Table */}
          <Card>
            <CardHeader>
              <CardTitle>Ausrüstungsgegenstände</CardTitle>
              <CardDescription>
                {isLoading ? 'Lädt...' : `${equipmentItems.length} Gegenstände in Ihrer Ausrüstung`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(45,79,30)]"></div>
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
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Equipment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neuen Gegenstand hinzufügen</DialogTitle>
            <DialogDescription>
              Fügen Sie einen neuen Ausrüstungsgegenstand hinzu
            </DialogDescription>
          </DialogHeader>
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
                <Label htmlFor="gewicht">Gewicht (g)</Label>
                <Input
                  id="gewicht"
                  type="number"
                  value={formData.einzelgewicht}
                  onChange={(e) => setFormData({ ...formData, einzelgewicht: e.target.value })}
                  placeholder="z.B. 2500"
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
                    <SelectItem value="">Kein Transport</SelectItem>
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
                    <SelectItem value="Immer gepackt">Immer gepackt</SelectItem>
                    <SelectItem value="Immer dabei">Immer dabei</SelectItem>
                    <SelectItem value="Optional">Optional</SelectItem>
                    <SelectItem value="Ausgemustert">Ausgemustert</SelectItem>
                  </SelectContent>
                </Select>
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
        </DialogContent>
      </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gegenstand bearbeiten</DialogTitle>
            <DialogDescription>
              Bearbeiten Sie die Details des Ausrüstungsgegenstands
            </DialogDescription>
          </DialogHeader>
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
                <Label htmlFor="edit-gewicht">Gewicht (g)</Label>
                <Input
                  id="edit-gewicht"
                  type="number"
                  value={formData.einzelgewicht}
                  onChange={(e) => setFormData({ ...formData, einzelgewicht: e.target.value })}
                  placeholder="z.B. 2500"
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
                    <SelectItem value="">Kein Transport</SelectItem>
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
                    <SelectItem value="Immer gepackt">Immer gepackt</SelectItem>
                    <SelectItem value="Immer dabei">Immer dabei</SelectItem>
                    <SelectItem value="Optional">Optional</SelectItem>
                    <SelectItem value="Ausgemustert">Ausgemustert</SelectItem>
                  </SelectContent>
                </Select>
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
