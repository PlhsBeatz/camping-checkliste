'use client'

import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list'
import { EquipmentList } from '@/components/equipment-list'
import { Plus, Package, MapPin, Users } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Vacation, PackingItem, EquipmentItem } from '@/lib/db'

export default function Home() {
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set())

  // Fetch Vacations
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = await res.json()
        if (data.success) {
          setVacations(data.data)
          if (data.data.length > 0 && !selectedVacationId) {
            setSelectedVacationId(data.data[0].id) // Select the first vacation by default
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
            // Initialize packedItems set based on fetched data
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

    // Update backend
    try {
      await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, gepackt: !isCurrentlyPacked }),
      })
    } catch (error) {
      console.error('Failed to update packing item:', error)
      // Revert UI state if API call fails
      setPackedItems(packedItems)
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
          <Button size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Neuer Urlaub
          </Button>
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
                <CardTitle>Packliste: {currentVacation?.titel}</CardTitle>
                <CardDescription>
                  {currentVacation?.reiseziel_name} • {currentVacation?.startdatum} bis {currentVacation?.enddatum}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PackingList
                  items={packingItems}
                  onToggleItem={handleToggleItem}
                  hidePackedItems={false}
                />
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
              {vacations.map((vacation) => (
                <Card
                  key={vacation.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedVacationId(vacation.id)}
                >
                  <CardHeader>
                    <CardTitle>{vacation.titel}</CardTitle>
                    <CardDescription>
                      <div className="space-y-1 mt-2">
                        <p>📍 {vacation.reiseziel_name}</p>
                        <p>📅 {vacation.startdatum} bis {vacation.enddatum}</p>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm">
                      Öffnen
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  )
}
