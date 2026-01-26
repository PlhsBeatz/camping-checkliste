'use client'

import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list'
import { EquipmentList } from '@/components/equipment-list'
import { Plus, Package, MapPin, Users } from 'lucide-react'
import { useState } from 'react'

// Mock-Daten für die Demo
const mockVacations = [
  {
    id: '1',
    title: 'Sommerurlaub 2025',
    destination: 'Campingplatz am See',
    startDate: '2025-07-15',
    endDate: '2025-07-30',
    travelers: ['Ich', 'Partnerin', 'Kind 1', 'Kind 2'],
  },
  {
    id: '2',
    title: 'Herbsttrip',
    destination: 'Schwarzwald',
    startDate: '2025-09-01',
    endDate: '2025-09-08',
    travelers: ['Ich', 'Partnerin'],
  },
]

const mockPackingItems = [
  {
    id: '1',
    name: 'Sitzplatten',
    quantity: 1,
    isPacked: true,
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    details: 'ALKO Big-Foots',
  },
  {
    id: '2',
    name: 'Gasflasche Alugas (11kg)',
    quantity: 1,
    isPacked: true,
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    details: 'Alugas 11kg',
  },
  {
    id: '3',
    name: 'Gießkanne',
    quantity: 1,
    isPacked: false,
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    details: 'Gießkanne gelb Kunststoff 14 L',
  },
  {
    id: '4',
    name: 'Abwasserschlauch',
    quantity: 3,
    isPacked: false,
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    details: 'RK Reich Abwasser-Entsorgungs-Set',
  },
]

const mockEquipment: Array<any> = [
  {
    id: '1',
    title: 'Sitzplatten',
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    weight: 2.50,
    defaultQuantity: 1,
    status: 'Fest Installiert' as const,
    details: 'ALKO Big-Foots',
    links: [],
    onEdit: () => {},
  },
  {
    id: '2',
    title: 'Gasflasche Alugas (11kg)',
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    weight: 16.50,
    defaultQuantity: 1,
    status: 'Fest Installiert' as const,
    details: 'Alugas 11kg',
    links: [],
    onEdit: () => {},
  },
  {
    id: '3',
    title: 'Gießkanne',
    category: 'Wohnwagen',
    mainCategory: 'Campingausrüstung',
    weight: 0.58,
    defaultQuantity: 1,
    status: 'Immer gepackt' as const,
    details: 'Gießkanne gelı Kunststoff 14 L',
    links: ['https://www.hornbach.de/shop/Giesskanne-gel-Kunststoff-14-l/5106779/artikel.html'],
    onEdit: () => {},
  },
]

export default function Home() {
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set(['1', '2']))
  const [selectedVacation, setSelectedVacation] = useState<string>('1')

  const handleToggleItem = (id: string) => {
    const newPacked = new Set(packedItems)
    if (newPacked.has(id)) {
      newPacked.delete(id)
    } else {
      newPacked.add(id)
    }
    setPackedItems(newPacked)
  }

  const currentVacation = mockVacations.find(v => v.id === selectedVacation)
  const packedCount = packedItems.size
  const totalItems = mockPackingItems.length
  const packingPercentage = Math.round((packedCount / totalItems) * 100)

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
              <div className="text-2xl font-bold">{mockVacations.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ausrüstung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockEquipment.length}</div>
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
                <CardTitle>Packliste: {currentVacation?.title}</CardTitle>
                <CardDescription>
                  {currentVacation?.destination} • {currentVacation?.startDate} bis {currentVacation?.endDate}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PackingList
                  items={mockPackingItems}
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
                  items={mockEquipment}
                  onEditItem={(id) => console.log('Edit:', id)}
                  onAddItem={() => console.log('Add new item')}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vacations Tab */}
          <TabsContent value="vacations" className="space-y-4">
            <div className="grid gap-4">
              {mockVacations.map((vacation) => (
                <Card
                  key={vacation.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedVacation(vacation.id)}
                >
                  <CardHeader>
                    <CardTitle>{vacation.title}</CardTitle>
                    <CardDescription>
                      <div className="space-y-1 mt-2">
                        <p>📍 {vacation.destination}</p>
                        <p>📅 {vacation.startDate} bis {vacation.endDate}</p>
                        <p>👥 {vacation.travelers.length} Personen</p>
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
