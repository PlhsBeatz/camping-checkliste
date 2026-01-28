'use client'

import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list'
import { EquipmentList } from '@/components/equipment-list'
import { Plus, Package, MapPin, Users, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface Vacation {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: string
}

interface PackingItem {
  id: string
  vacationId: string
  name: string
  quantity: number
  isPacked: boolean
  category: string
  mainCategory: string
  details?: string
  weight?: number
}

export default function Home() {
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [selectedVacation, setSelectedVacation] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCreatingVacation, setIsCreatingVacation] = useState(false)
  const [newVacationTitle, setNewVacationTitle] = useState('')
  const [newVacationDestination, setNewVacationDestination] = useState('')
  const [newVacationStartDate, setNewVacationStartDate] = useState('')
  const [newVacationEndDate, setNewVacationEndDate] = useState('')

  // Laden der Urlaubsreisen beim Komponenten-Mount
  useEffect(() => {
    loadVacations()
  }, [])

  // Laden der Packartikel, wenn eine Urlaubsreise ausgewählt wird
  useEffect(() => {
    if (selectedVacation) {
      loadPackingItems(selectedVacation)
    }
  }, [selectedVacation])

  const loadVacations = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/vacations')
      const data = await response.json()

      if (data.success) {
        setVacations(data.data)
        if (data.data.length > 0) {
          setSelectedVacation(data.data[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading vacations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPackingItems = async (vacationId: string) => {
    try {
      const response = await fetch(`/api/packing-items?vacationId=${vacationId}`)
      const data = await response.json()

      if (data.success) {
        setPackingItems(data.data)
      }
    } catch (error) {
      console.error('Error loading packing items:', error)
    }
  }

  const handleCreateVacation = async () => {
    if (!newVacationTitle || !newVacationDestination || !newVacationStartDate || !newVacationEndDate) {
      alert('Bitte füllen Sie alle Felder aus')
      return
    }

    try {
      setIsCreatingVacation(true)
      const response = await fetch('/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newVacationTitle,
          destination: newVacationDestination,
          startDate: newVacationStartDate,
          endDate: newVacationEndDate,
          travelers: 'Familie',
        }),
      })

      const data = await response.json()

      if (data.success) {
        setNewVacationTitle('')
        setNewVacationDestination('')
        setNewVacationStartDate('')
        setNewVacationEndDate('')
        await loadVacations()
      }
    } catch (error) {
      console.error('Error creating vacation:', error)
      alert('Fehler beim Erstellen der Urlaubsreise')
    } finally {
      setIsCreatingVacation(false)
    }
  }

  const handleToggleItem = async (id: string) => {
    const item = packingItems.find((i) => i.id === id)
    if (!item) return

    try {
      const response = await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          isPacked: !item.isPacked,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPackingItems((items) =>
          items.map((i) => (i.id === id ? { ...i, isPacked: !i.isPacked } : i))
        )
      }
    } catch (error) {
      console.error('Error updating item:', error)
    }
  }

  const handleAddItem = async () => {
    if (!selectedVacation) return

    const newItem = {
      vacationId: selectedVacation,
      name: 'Neuer Artikel',
      quantity: 1,
      isPacked: false,
      category: 'Sonstiges',
      mainCategory: 'Campingausrüstung',
      details: '',
    }

    try {
      const response = await fetch('/api/packing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      })

      const data = await response.json()

      if (data.success) {
        setPackingItems([...packingItems, data.data])
      }
    } catch (error) {
      console.error('Error adding item:', error)
    }
  }

  const packedCount = packingItems.filter((item) => item.isPacked).length
  const totalCount = packingItems.length

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Camping Packliste</h1>
            <p className="text-muted-foreground mt-2">Organisieren Sie Ihre Campingausrüstung und Packlisten</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Neue Reise
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Urlaubsreise erstellen</DialogTitle>
                <DialogDescription>Fügen Sie eine neue Campingreise hinzu</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Titel</label>
                  <Input
                    value={newVacationTitle}
                    onChange={(e) => setNewVacationTitle(e.target.value)}
                    placeholder="z.B. Sommerurlaub 2025"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Ziel</label>
                  <Input
                    value={newVacationDestination}
                    onChange={(e) => setNewVacationDestination(e.target.value)}
                    placeholder="z.B. Schwarzwald"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Startdatum</label>
                  <Input
                    type="date"
                    value={newVacationStartDate}
                    onChange={(e) => setNewVacationStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Enddatum</label>
                  <Input
                    type="date"
                    value={newVacationEndDate}
                    onChange={(e) => setNewVacationEndDate(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateVacation} disabled={isCreatingVacation} className="w-full">
                  {isCreatingVacation ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Vacations Tabs */}
        {vacations.length > 0 ? (
          <Tabs value={selectedVacation || ''} onValueChange={setSelectedVacation} className="w-full">
            <TabsList className="grid grid-flow-col auto-cols-fr mb-4 overflow-x-auto w-full">
              {vacations.map((vacation) => (
                <TabsTrigger key={vacation.id} value={vacation.id} className="text-xs sm:text-sm">
                  {vacation.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {vacations.map((vacation) => (
              <TabsContent key={vacation.id} value={vacation.id} className="space-y-4">
                {/* Vacation Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      {vacation.destination}
                    </CardTitle>
                    <CardDescription>
                      {new Date(vacation.startDate).toLocaleDateString('de-DE')} -{' '}
                      {new Date(vacation.endDate).toLocaleDateString('de-DE')}
                    </CardDescription>
                  </CardHeader>
                </Card>

                {/* Packing Progress */}
                {totalCount > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Packfortschritt</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{packedCount} von {totalCount} Artikeln gepackt</span>
                          <span className="font-medium">{Math.round((packedCount / totalCount) * 100)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all duration-300 rounded-full"
                            style={{ width: `${(packedCount / totalCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Packing List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Packliste
                      </CardTitle>
                      <Button size="sm" onClick={handleAddItem}>
                        <Plus className="w-4 h-4 mr-1" />
                        Artikel hinzufügen
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {packingItems.length > 0 ? (
                      <PackingList items={packingItems} onToggleItem={handleToggleItem} />
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Noch keine Artikel in dieser Packliste. Fügen Sie einen hinzu!
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Keine Urlaubsreisen vorhanden</CardTitle>
              <CardDescription>Erstellen Sie eine neue Reise, um zu beginnen</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </Layout>
  )
}
