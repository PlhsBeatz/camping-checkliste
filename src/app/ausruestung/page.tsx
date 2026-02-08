'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PackingList } from '@/components/packing-list-enhanced'
import { PackingListGenerator } from '@/components/packing-list-generator'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { PackingSettingsSidebar } from '@/components/packing-settings-sidebar'
import { Plus, Sparkles, Menu, Users2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Vacation, PackingItem, TransportVehicle, Mitreisender } from '@/lib/db'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Helper function to find the next vacation
const findNextVacation = (vacations: Vacation[]): Vacation | null => {
  if (vacations.length === 0) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Find vacations that haven't ended yet
  const upcomingVacations = vacations.filter(v => {
    const endDate = new Date(v.enddatum)
    endDate.setHours(23, 59, 59, 999)
    return endDate >= today
  })
  
  if (upcomingVacations.length === 0) {
    // No upcoming vacations, return the most recent one
    return vacations.sort((a, b) => 
      new Date(b.enddatum).getTime() - new Date(a.enddatum).getTime()
    )[0] || null
  }
  
  // Return the vacation with the earliest start date
  return upcomingVacations.sort((a, b) => 
    new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime()
  )[0] || null
}

export default function Home() {
  // Data state
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [_transportVehicles, _setTransportVehicles] = useState<TransportVehicle[]>([])
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  
  // UI state
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [showPackSettings, setShowPackSettings] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false)
  const [editingPackingItemId, setEditingPackingItemId] = useState<string | null>(null)
  const [_equipmentSearchTerm, _setEquipmentSearchTerm] = useState('')
  const [selectedPackProfile, setSelectedPackProfile] = useState<string | null>(null)
  const [hidePackedItems, setHidePackedItems] = useState(false)
  
  // Form state
  const [packingItemForm, setPackingItemForm] = useState({
    gegenstandId: '',
    anzahl: '1',
    bemerkung: '',
    transportId: ''
  })

  // Fetch Vacations and select next vacation
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = await res.json()
        if (data.success) {
          setVacations(data.data)
          
          // Only auto-select if no vacation is currently selected
          if (!selectedVacationId && data.data.length > 0) {
            const nextVacation = findNextVacation(data.data)
            if (nextVacation) {
              setSelectedVacationId(nextVacation.id)
            }
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

  // Load mitreisende for selected vacation
  useEffect(() => {
    const fetchVacationMitreisende = async () => {
      if (selectedVacationId) {
        try {
          const res = await fetch(`/api/mitreisende?vacationId=${selectedVacationId}`)
          const data = await res.json()
          if (data.success) {
            setVacationMitreisende(data.data)
          }
        } catch (error) {
          console.error('Failed to fetch vacation mitreisende:', error)
        }
      } else {
        setVacationMitreisende([])
      }
    }
    fetchVacationMitreisende()
  }, [selectedVacationId])

  // Fetch Transport Vehicles
  useEffect(() => {
    const fetchTransportVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = await res.json()
        if (data.success) {
          _setTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
      }
    }
    fetchTransportVehicles()
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

  const handleToggleMitreisender = async (packingItemId: string, mitreisenderId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus

    // Optimistically update UI
    const updatedPackingItems = packingItems.map(item => {
      if (item.id === packingItemId && item.mitreisende) {
        return {
          ...item,
          mitreisende: item.mitreisende.map(m => 
            m.mitreisender_id === mitreisenderId 
              ? { ...m, gepackt: newStatus }
              : m
          )
        }
      }
      return item
    })
    setPackingItems(updatedPackingItems)

    try {
      const res = await fetch('/api/packing-items/toggle-mitreisender', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          packingItemId, 
          mitreisenderId, 
          gepackt: newStatus 
        }),
      })
      const data = await res.json()
      if (!data.success) {
        console.error('Failed to update mitreisender status:', data.error)
        // Revert on error
        setPackingItems(packingItems)
      }
    } catch (error) {
      console.error('Failed to update mitreisender status:', error)
      // Revert on error
      setPackingItems(packingItems)
    }
  }

  // Handle toggling multiple mitreisende at once (for mark-all/unmark-all)
  const handleToggleMultipleMitreisende = async (packingItemId: string, updates: Array<{ mitreisenderId: string; newStatus: boolean }>) => {
    // Optimistically update UI in a single batch
    const updatedPackingItems = packingItems.map(item => {
      if (item.id === packingItemId && item.mitreisende) {
        return {
          ...item,
          mitreisende: item.mitreisende.map(m => {
            const update = updates.find(u => u.mitreisenderId === m.mitreisender_id)
            return update ? { ...m, gepackt: update.newStatus } : m
          })
        }
      }
      return item
    })
    setPackingItems(updatedPackingItems)

    // Send all updates to the server
    try {
      await Promise.all(updates.map(({ mitreisenderId, newStatus }) =>
        fetch('/api/packing-items/toggle-mitreisender', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            packingItemId, 
            mitreisenderId, 
            gepackt: newStatus 
          }),
        })
      ))
    } catch (error) {
      console.error('Failed to update mitreisende:', error)
      // Revert on error
      setPackingItems(packingItems)
    }
  }

  const _handleAddPackingItem = async () => {
    if (!packingItemForm.gegenstandId || !selectedVacationId) {
      alert('Bitte wählen Sie einen Gegenstand aus')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/packing-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vacationId: selectedVacationId,
          gegenstandId: packingItemForm.gegenstandId,
          anzahl: parseInt(packingItemForm.anzahl) || 1,
          bemerkung: packingItemForm.bemerkung || null,
          transportId: packingItemForm.transportId || null,
          mitreisende: []
        })
      })
      const data = await res.json()
      if (data.success) {
        // Refresh packing items
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setPackingItems(itemsData.data)
          const packed = new Set<string>(itemsData.data.filter((item: PackingItem) => item.gepackt).map((item: PackingItem) => item.id))
          setPackedItems(packed)
        }
        setShowAddItemDialog(false)
        setPackingItemForm({ gegenstandId: '', anzahl: '1', bemerkung: '', transportId: '' })
        _setEquipmentSearchTerm('')
      } else {
        alert('Fehler beim Hinzufügen: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to add packing item:', error)
      alert('Fehler beim Hinzufügen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditPackingItem = (item: PackingItem) => {
    setEditingPackingItemId(item.id)
    setPackingItemForm({
      gegenstandId: item.gegenstand_id,
      anzahl: String(item.anzahl),
      bemerkung: item.bemerkung || '',
      transportId: item.transport_id || ''
    })
    setShowEditItemDialog(true)
  }

  const handleUpdatePackingItem = async () => {
    if (!editingPackingItemId) return

    setIsLoading(true)
    try {
      const res = await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPackingItemId,
          anzahl: parseInt(packingItemForm.anzahl) || 1,
          bemerkung: packingItemForm.bemerkung || null
        })
      })
      const data = await res.json()
      if (data.success && selectedVacationId) {
        // Refresh packing items
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setPackingItems(itemsData.data)
          const packed = new Set<string>(itemsData.data.filter((item: PackingItem) => item.gepackt).map((item: PackingItem) => item.id))
          setPackedItems(packed)
        }
        setShowEditItemDialog(false)
        setEditingPackingItemId(null)
        setPackingItemForm({ gegenstandId: '', anzahl: '1', bemerkung: '', transportId: '' })
      } else {
        alert('Fehler beim Aktualisieren: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to update packing item:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePackingItem = async (id: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich aus der Packliste entfernen?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/packing-items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success && selectedVacationId) {
        // Refresh packing items
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setPackingItems(itemsData.data)
          const packed = new Set<string>(itemsData.data.filter((item: PackingItem) => item.gepackt).map((item: PackingItem) => item.id))
          setPackedItems(packed)
        }
      } else {
        alert('Fehler beim Löschen: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to delete packing item:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGeneratePackingList = async () => {
    if (!selectedVacationId) return
    
    // Refresh packing items after generation
    const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
    const itemsData = await itemsRes.json()
    if (itemsData.success) {
      setPackingItems(itemsData.data)
      const packed = new Set<string>(itemsData.data.filter((item: PackingItem) => item.gepackt).map((item: PackingItem) => item.id))
      setPackedItems(packed)
    }
    setShowGeneratorDialog(false)
  }

  // Computed values
  const currentVacation = vacations.find(v => v.id === selectedVacationId)

  // Get initials for pack profile button
  const getInitials = (name: string) => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Note: equipmentItems will be fetched in the add item dialog when needed
  // to avoid loading all equipment on page load

  return (
    <div className="min-h-screen bg-[rgb(250,250,249)] flex">
      {/* Navigation Sidebar (Links) */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300",
        "lg:ml-[280px]" // Platz für permanente Sidebar auf Desktop
      )}>
        <div className="container mx-auto p-4 md:p-6 space-y-0">
          {/* Header mit Toggle-Buttons - White Background */}
          <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 p-6">
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
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    {currentVacation?.titel || 'Kein Urlaub ausgewählt'}
                  </h1>
                </div>
              </div>

              {/* Pack Profile Toggle - Initials Badge Style */}
              {currentVacation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPackSettings(true)}
                  className="flex items-center gap-2 h-10 px-3 rounded-full border-2 border-gray-900 bg-gray-900 text-white hover:bg-gray-800 font-semibold"
                >
                  <span className="text-sm">
                    {selectedPackProfile 
                      ? getInitials(vacationMitreisende.find(m => m.id === selectedPackProfile)?.name || 'AL')
                      : 'AL'}
                  </span>
                  <Users2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Packliste Content */}
          {!currentVacation ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub über die Navigation!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-0">
              {/* Automatisch generieren Button - nur wenn Liste leer */}
              {packingItems.length === 0 && (
                <Card className="border-dashed rounded-none border-x border-b">
                  <CardContent className="pt-6 text-center">
                    <p className="text-muted-foreground mb-4">
                      Ihre Packliste ist leer. Generieren Sie automatisch Vorschläge oder fügen Sie manuell Gegenstände hinzu.
                    </p>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={() => setShowGeneratorDialog(true)}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Automatisch generieren
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Packing List - White Background */}
              {packingItems.length > 0 && (
                <div className="bg-white rounded-b-xl border border-gray-200 p-6">
                  <PackingList
                    items={packingItems}
                    onToggle={handleToggleItem}
                    onToggleMitreisender={handleToggleMitreisender}
                    onToggleMultipleMitreisende={handleToggleMultipleMitreisende}
                    onEdit={handleEditPackingItem}
                    onDelete={handleDeletePackingItem}
                    selectedProfile={selectedPackProfile}
                    hidePackedItems={hidePackedItems}
                    onOpenSettings={() => setShowPackSettings(true)}
                  />
                </div>
              )}

              {/* Edit Item Dialog */}
              <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Packlisten-Eintrag bearbeiten</DialogTitle>
                    <DialogDescription>
                      Anzahl und Bemerkung anpassen
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-anzahl">Anzahl</Label>
                      <Input
                        id="edit-anzahl"
                        type="number"
                        min="1"
                        value={packingItemForm.anzahl}
                        onChange={(e) => setPackingItemForm({ ...packingItemForm, anzahl: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-bemerkung">Bemerkung (optional)</Label>
                      <Input
                        id="edit-bemerkung"
                        placeholder="z.B. nur für Wanderungen"
                        value={packingItemForm.bemerkung}
                        onChange={(e) => setPackingItemForm({ ...packingItemForm, bemerkung: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleUpdatePackingItem} disabled={isLoading} className="w-full">
                      {isLoading ? 'Wird aktualisiert...' : 'Aktualisieren'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Pack Settings Sidebar (Rechts) */}
      <PackingSettingsSidebar
        isOpen={showPackSettings}
        onClose={() => setShowPackSettings(false)}
        mitreisende={vacationMitreisende}
        selectedProfile={selectedPackProfile}
        onProfileChange={setSelectedPackProfile}
        hidePackedItems={hidePackedItems}
        onHidePackedChange={setHidePackedItems}
      />

      {/* FAB Button für Gegenstand hinzufügen */}
      {currentVacation && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            size="lg"
            onClick={() => setShowAddItemDialog(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Add Item Dialog - Simplified version, will be enhanced later */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gegenstand hinzufügen</DialogTitle>
            <DialogDescription>
              Diese Funktion wird über die Ausrüstungsseite verfügbar sein
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bitte navigieren Sie zur Ausrüstungsseite, um Gegenstände zur Packliste hinzuzufügen.
          </p>
        </DialogContent>
      </Dialog>

      {/* Packing List Generator Dialog */}
      <PackingListGenerator
        open={showGeneratorDialog}
        onOpenChange={setShowGeneratorDialog}
        vacationId={selectedVacationId || ''}
        onGenerate={handleGeneratePackingList}
      />
    </div>
  )
}
