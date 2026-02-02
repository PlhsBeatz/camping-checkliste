'use client'

import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list'
import { Plus, Package, MapPin, Users, Trash2, Edit2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Vacation, PackingItem, EquipmentItem } from '@/lib/db'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function Home() {
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [showNewVacationDialog, setShowNewVacationDialog] = useState(false)
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false)
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null)
  const [newVacationForm, setNewVacationForm] = useState({
    titel: '',
    startdatum: '',
    enddatum: '',
    reiseziel_name: ''
  })
  const [newEquipmentForm, setNewEquipmentForm] = useState({
    was: '',
    kategorie_id: '',
    einzelgewicht: '',
    standard_anzahl: '1',
    status: 'Immer gepackt',
    details: ''
  })

  // Fetch Vacations
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = await res.json()
        if (data.success) {
          setVacations(data.data)
          if (data.data.length > 0 && !selectedVacationId) {
            setSelectedVacationId(data.data[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch vacations:', error)
      }
    }
    fetchVacations()
  }, [selectedVacationId])

  // Fetch Packing Items for selected vacation
  useEffect(() => {
    const fetchPackingItems = async () => {
      if (selectedVacationId) {
        try {
          const res = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
          const data = await res.json()
          if (data.success) {
            setPackingItems(data.data)
            const initialPacked = new Set<string>()
            data.data.forEach((item: PackingItem) => {
              if (item.gepackt) {
                initialPacked.add(item.id)
              }
            })
            setPackedItems(initialPacked)
          }
        } catch (error) {
          console.error('Failed to fetch packing items:', error)
        }
      }
    }
    fetchPackingItems()
  }, [selectedVacationId])

  // Fetch Equipment Items
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

  const handleToggleItem = async (id: string) => {
    const isCurrentlyPacked = packedItems.has(id)
    const newPacked = new Set(packedItems)

    // Update state immediately for visual feedback
    if (isCurrentlyPacked) {
      newPacked.delete(id)
    } else {
      newPacked.add(id)
    }
    setPackedItems(newPacked)

    // Update packingItems array to reflect the change
    const updatedPackingItems = packingItems.map(item =>
      item.id === id ? { ...item, gepackt: !isCurrentlyPacked } : item
    )
    setPackingItems(updatedPackingItems)

    try {
      const res = await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, gepackt: !isCurrentlyPacked }),
      })
      const data = await res.json()
      if (!data.success) {
        console.error('Failed to update packing item:', data.error)
        // Revert on error
        setPackedItems(packedItems)
        setPackingItems(packingItems)
      }
    } catch (error) {
      console.error('Failed to update packing item:', error)
      // Revert on error
      setPackedItems(packedItems)
      setPackingItems(packingItems)
    }
  }

  const handleCreateVacation = async () => {
    if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVacationForm)
      })
      const data = await res.json()
      if (data.success) {
        setVacations([...vacations, data.data])
        setSelectedVacationId(data.data.id)
        setShowNewVacationDialog(false)
        setNewVacationForm({
          titel: '',
          startdatum: '',
          enddatum: '',
          reiseziel_name: ''
        })
      } else {
        alert('Fehler beim Erstellen des Urlaubs: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to create vacation:', error)
      alert('Fehler beim Erstellen des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteVacation = async (vacationId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Urlaub löschen möchten?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/vacations?id=${vacationId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        const updatedVacations = vacations.filter(v => v.id !== vacationId)
        setVacations(updatedVacations)
        
        if (selectedVacationId === vacationId) {
          const nextVacation = updatedVacations.length > 0 ? updatedVacations[0] : null
          setSelectedVacationId(nextVacation ? nextVacation.id : null)
        }
      } else {
        alert('Fehler beim Löschen des Urlaubs: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete vacation:', error)
      alert('Fehler beim Löschen des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateEquipment = async () => {
    if (!newEquipmentForm.was || !newEquipmentForm.kategorie_id) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const method = editingEquipmentId ? 'PUT' : 'POST'
      const body = editingEquipmentId
        ? { ...newEquipmentForm, id: editingEquipmentId, einzelgewicht: newEquipmentForm.einzelgewicht ? parseFloat(newEquipmentForm.einzelgewicht) : null, standard_anzahl: parseInt(newEquipmentForm.standard_anzahl) }
        : { ...newEquipmentForm, einzelgewicht: newEquipmentForm.einzelgewicht ? parseFloat(newEquipmentForm.einzelgewicht) : null, standard_anzahl: parseInt(newEquipmentForm.standard_anzahl) }

      const res = await fetch('/api/equipment-items', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        if (editingEquipmentId) {
          setEquipmentItems(equipmentItems.map(item => item.id === editingEquipmentId ? data.data : item))
        } else {
          setEquipmentItems([...equipmentItems, data.data])
        }
        setShowEquipmentDialog(false)
        setEditingEquipmentId(null)
        setNewEquipmentForm({
          was: '',
          kategorie_id: '',
          einzelgewicht: '',
          standard_anzahl: '1',
          status: 'Immer gepackt',
          details: ''
        })
      } else {
        alert('Fehler beim Speichern des Gegenstands: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save equipment:', error)
      alert('Fehler beim Speichern des Gegenstands')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditEquipment = (item: EquipmentItem) => {
    setEditingEquipmentId(item.id)
    setNewEquipmentForm({
      was: item.was,
      kategorie_id: item.kategorie_id,
      einzelgewicht: item.einzelgewicht?.toString() || '',
      standard_anzahl: item.standard_anzahl.toString(),
      status: item.status,
      details: item.details || ''
    })
    setShowEquipmentDialog(true)
  }

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!confirm('Sind Sie sicher, dass Sie diesen Gegenstand löschen möchten?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/equipment-items?id=${equipmentId}`, {
        method: 'DELETE'
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

  const handleCloseEquipmentDialog = () => {
    setShowEquipmentDialog(false)
    setEditingEquipmentId(null)
    setNewEquipmentForm({
      was: '',
      kategorie_id: '',
      einzelgewicht: '',
      standard_anzahl: '1',
      status: 'Immer gepackt',
      details: ''
    })
  }

  const currentVacation = vacations.find(v => v.id === selectedVacationId)
  const totalItems = packingItems.length
  const packedCount = packedItems.size
  const packingPercentage = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Camping Packlisten</h1>
            <p className="text-muted-foreground mt-2">Organisieren Sie Ihre Campingausrüstung intelligent</p>
          </div>
          <Dialog open={showNewVacationDialog} onOpenChange={setShowNewVacationDialog}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Neuer Urlaub
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuen Urlaub erstellen</DialogTitle>
                <DialogDescription>
                  Geben Sie die Details für Ihren neuen Urlaub ein
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="titel">Titel</Label>
                  <Input
                    id="titel"
                    placeholder="z.B. Sommerurlaub 2024"
                    value={newVacationForm.titel}
                    onChange={(e) => setNewVacationForm({ ...newVacationForm, titel: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="reiseziel">Reiseziel</Label>
                  <Input
                    id="reiseziel"
                    placeholder="z.B. Schwarzwald"
                    value={newVacationForm.reiseziel_name}
                    onChange={(e) => setNewVacationForm({ ...newVacationForm, reiseziel_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startdatum">Startdatum</Label>
                    <Input
                      id="startdatum"
                      type="date"
                      value={newVacationForm.startdatum}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, startdatum: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="enddatum">Enddatum</Label>
                    <Input
                      id="enddatum"
                      type="date"
                      value={newVacationForm.enddatum}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, enddatum: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleCreateVacation} disabled={isLoading} className="w-full">
                  {isLoading ? 'Wird erstellt...' : 'Urlaub erstellen'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Urlaube</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vacations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ausrüstung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{equipmentItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gepackt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{packedCount}/{totalItems}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fortschritt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{packingPercentage}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="packing" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="packing">
              <Package className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Packliste</span>
            </TabsTrigger>
            <TabsTrigger value="equipment">
              <MapPin className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Ausrüstung</span>
            </TabsTrigger>
            <TabsTrigger value="vacations">
              <Users className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Urlaube</span>
            </TabsTrigger>
          </TabsList>

          {/* Packing Tab */}
          <TabsContent value="packing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Packliste: {currentVacation?.titel || 'Keine Auswahl'}</CardTitle>
                <CardDescription>
                  {currentVacation ? (
                    <>
                      {currentVacation.reiseziel_name} • {currentVacation.startdatum} bis {currentVacation.enddatum}
                    </>
                  ) : (
                    'Wählen Sie einen Urlaub aus, um die Packliste zu sehen'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentVacation ? (
                  <PackingList
                    items={packingItems}
                    onToggleItem={handleToggleItem}
                    hidePackedItems={false}
                  />
                ) : (
                  <p className="text-muted-foreground">Keine Urlaube vorhanden</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Ausrüstungsverwaltung</CardTitle>
                    <CardDescription>
                      Verwalten Sie Ihre Camping-Ausrüstungsgegenstände
                    </CardDescription>
                  </div>
                  <Dialog open={showEquipmentDialog} onOpenChange={(open) => {
                    if (!open) {
                      handleCloseEquipmentDialog()
                    } else {
                      setShowEquipmentDialog(true)
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Neuer Gegenstand
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingEquipmentId ? 'Gegenstand bearbeiten' : 'Neuen Gegenstand erstellen'}
                        </DialogTitle>
                        <DialogDescription>
                          {editingEquipmentId ? 'Bearbeiten Sie die Details des Gegenstands' : 'Geben Sie die Details für einen neuen Gegenstand ein'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="was">Bezeichnung</Label>
                          <Input
                            id="was"
                            placeholder="z.B. Zelt"
                            value={newEquipmentForm.was}
                            onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, was: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="kategorie">Kategorie ID</Label>
                          <Input
                            id="kategorie"
                            placeholder="z.B. 1"
                            value={newEquipmentForm.kategorie_id}
                            onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, kategorie_id: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="gewicht">Gewicht (kg)</Label>
                            <Input
                              id="gewicht"
                              type="number"
                              step="0.1"
                              placeholder="z.B. 2.5"
                              value={newEquipmentForm.einzelgewicht}
                              onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, einzelgewicht: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="anzahl">Standard-Anzahl</Label>
                            <Input
                              id="anzahl"
                              type="number"
                              placeholder="z.B. 1"
                              value={newEquipmentForm.standard_anzahl}
                              onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, standard_anzahl: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="status">Status</Label>
                          <select
                            id="status"
                            value={newEquipmentForm.status}
                            onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, status: e.target.value })}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="Immer gepackt">Immer gepackt</option>
                            <option value="Fest Installiert">Fest Installiert</option>
                            <option value="Ausgemustert">Ausgemustert</option>
                            <option value="Optional">Optional</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="details">Details</Label>
                          <Input
                            id="details"
                            placeholder="z.B. 3-Personen Zelt"
                            value={newEquipmentForm.details}
                            onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, details: e.target.value })}
                          />
                        </div>
                        <Button onClick={handleCreateEquipment} disabled={isLoading} className="w-full">
                          {isLoading ? 'Wird gespeichert...' : editingEquipmentId ? 'Gegenstand aktualisieren' : 'Gegenstand erstellen'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {equipmentItems.map(item => (
                    <Card key={item.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-grow">
                            <CardTitle className="text-base">{item.was}</CardTitle>
                            <CardDescription className="text-xs">
                              {item.status}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditEquipment(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEquipment(item.id)}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 space-y-2 text-sm">
                        {item.einzelgewicht && (
                          <p><span className="font-medium">Gewicht:</span> {item.einzelgewicht} kg</p>
                        )}
                        <p><span className="font-medium">Standard-Anzahl:</span> {item.standard_anzahl}</p>
                        {item.details && (
                          <p><span className="font-medium">Details:</span> {item.details}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {equipmentItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Keine Gegenstände vorhanden. Erstellen Sie einen neuen Gegenstand!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vacations Tab */}
          <TabsContent value="vacations" className="space-y-4">
            <div className="grid gap-4">
              {vacations.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub!</p>
                  </CardContent>
                </Card>
              ) : (
                vacations.map((vacation) => (
                  <Card
                    key={vacation.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedVacationId(vacation.id)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle>{vacation.titel}</CardTitle>
                          <CardDescription>
                            <div className="space-y-1 mt-2">
                              <p>📍 {vacation.reiseziel_name}</p>
                              <p>📅 {vacation.startdatum} bis {vacation.enddatum}</p>
                            </div>
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteVacation(vacation.id)
                          }}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm">
                        Öffnen
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
