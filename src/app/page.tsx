'use client'

import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list'
import { EquipmentList } from '@/components/equipment-list'
import { Plus, Package, MapPin, Users, Trash2 } from 'lucide-react'
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
  const [newVacationForm, setNewVacationForm] = useState({
    titel: '',
    startdatum: '',
    enddatum: '',
    reiseziel_name: ''
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

    if (isCurrentlyPacked) {
      newPacked.delete(id)
    } else {
      newPacked.add(id)
    }
    setPackedItems(newPacked)

    try {
      const res = await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, gepackt: !isCurrentlyPacked }),
      })
      const data = await res.json()
      if (!data.success) {
        console.error('Failed to update packing item:', data.error)
        setPackedItems(packedItems)
      }
    } catch (error) {
      console.error('Failed to update packing item:', error)
      setPackedItems(packedItems)
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
        setVacations(vacations.filter(v => v.id !== vacationId))
        if (selectedVacationId === vacationId) {
          const remaining = vacations.filter(v => v.id !== vacationId)
          setSelectedVacationId(remaining.length > 0 ? remaining[0].id : null)
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
                <CardTitle>Ausrüstungsverwaltung</CardTitle>
                <CardDescription>
                  Verwalten Sie Ihre Camping-Ausrüstungsgegenstände
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EquipmentList
                  items={equipmentItems}
                  onEditItem={(id) => console.log('Edit:', id)}
                  onAddItem={() => console.log('Add new item')}
                />
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
