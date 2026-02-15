'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PackingList } from '@/components/packing-list-enhanced'
import { PackingListGenerator } from '@/components/packing-list-generator'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { PackingSettingsSidebar } from '@/components/packing-settings-sidebar'
import { Plus, Sparkles, Menu, Search, Users } from 'lucide-react'
import { useState, useEffect, Suspense, useMemo } from 'react'
import { Vacation, PackingItem, TransportVehicle, Mitreisender, EquipmentItem, Category, MainCategory } from '@/lib/db'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn, formatWeight } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'

const PACKABLE_STATUSES: readonly string[] = ['Normal', 'Immer gepackt']

// Helper function to find the next vacation - FIXED
const findNextVacation = (vacations: Vacation[]): Vacation | null => {
  if (vacations.length === 0) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // Find vacations that start today or in the future
  const upcomingVacations = vacations.filter(v => {
    const startDate = new Date(v.startdatum)
    startDate.setHours(0, 0, 0, 0)
    return startDate >= today
  })
  
  if (upcomingVacations.length === 0) {
    // No upcoming vacations, return the most recent one
    return vacations.sort((a, b) => 
      new Date(b.startdatum).getTime() - new Date(a.startdatum).getTime()
    )[0] || null
  }
  
  // Return the vacation with the earliest start date (closest to today)
  return upcomingVacations.sort((a, b) => 
    new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime()
  )[0] || null
}

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

function HomeContent() {
  // Data state
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [_transportVehicles, _setTransportVehicles] = useState<TransportVehicle[]>([])
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Equipment data for FAB modal
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  
  // UI state
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [showPackSettings, setShowPackSettings] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false)
  const [editingPackingItemId, setEditingPackingItemId] = useState<string | null>(null)
  const [_equipmentSearchTerm, _setEquipmentSearchTerm] = useState('')
  const [selectedPackProfile, setSelectedPackProfile] = useState<string | null>(null)
  const [hidePackedItems, setHidePackedItems] = useState(true)
  
  // FAB modal state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set())
  
  // Form state
  const [packingItemForm, setPackingItemForm] = useState({
    gegenstandId: '',
    anzahl: '1',
    bemerkung: '',
    transportId: ''
  })

  // Get URL parameters
  const searchParams = useSearchParams()
  const urlVacationId = searchParams.get('vacation')

  // Fetch Vacations and select vacation from URL or next vacation
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = await res.json()
        if (data.success) {
          setVacations(data.data)
          
          // Priority 1: URL parameter
          if (urlVacationId && data.data.some((v: Vacation) => v.id === urlVacationId)) {
            setSelectedVacationId(urlVacationId)
          }
          // Priority 2: Auto-select next vacation if no vacation is selected
          else if (!selectedVacationId && data.data.length > 0) {
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
  }, [urlVacationId, selectedVacationId])

  // Fetch Packing Items when vacation changes
  useEffect(() => {
    if (!selectedVacationId) return

    const fetchPackingItems = async () => {
      try {
        const res = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
        const data = await res.json()
        if (data.success) {
          setPackingItems(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch packing items:', error)
      }
    }
    fetchPackingItems()
  }, [selectedVacationId])

  // Fetch Mitreisende for vacation
  useEffect(() => {
    if (!selectedVacationId) return

    const fetchVacationMitreisende = async () => {
      try {
        const res = await fetch(`/api/mitreisende?vacationId=${selectedVacationId}`)
        const data = await res.json()
        if (data.success) {
          setVacationMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch vacation mitreisende:', error)
      }
    }
    fetchVacationMitreisende()
  }, [selectedVacationId])

  // Fetch Equipment Items for FAB modal
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

  // Get available equipment (not on packing list, only packable status)
  const availableEquipment = useMemo(() => {
    const packingItemEquipmentIds = new Set(packingItems.map(item => item.gegenstand_id))
    return equipmentItems.filter(
      eq => !packingItemEquipmentIds.has(eq.id) && PACKABLE_STATUSES.includes(eq.status)
    )
  }, [equipmentItems, packingItems])

  // Filter and group available equipment
  const groupedAvailableEquipment = useMemo(() => {
    const filtered = availableEquipment.filter(item => {
      if (!searchTerm) return true
      return item.was.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const mainCategoryGroups: Record<string, Record<string, EquipmentItem[]>> = {}
    
    filtered.forEach(item => {
      const category = categories.find(c => c.id === item.kategorie_id)
      if (!category) return
      
      const mainCategory = mainCategories.find(mc => mc.id === category.hauptkategorie_id)
      if (!mainCategory) return
      
      const mainCategoryName = mainCategory.titel
      const categoryName = category.titel
      
      if (!mainCategoryGroups[mainCategoryName]) {
        mainCategoryGroups[mainCategoryName] = {}
      }
      if (!mainCategoryGroups[mainCategoryName][categoryName]) {
        mainCategoryGroups[mainCategoryName][categoryName] = []
      }
      mainCategoryGroups[mainCategoryName][categoryName].push(item)
    })

    // Sort by main category order, then category order
    const sortedMainCategories = mainCategories
      .filter(mc => mainCategoryGroups[mc.titel])
      .map(mc => {
        const mainCatGroup = mainCategoryGroups[mc.titel]
        if (!mainCatGroup) return null
        
        return {
          id: mc.id,
          name: mc.titel,
          order: mc.reihenfolge || 0,
          categories: categories
            .filter(c => c.hauptkategorie_id === mc.id && mainCatGroup[c.titel])
            .sort((a, b) => (a.reihenfolge || 0) - (b.reihenfolge || 0))
            .map(c => ({
              id: c.id,
              name: c.titel,
              items: mainCatGroup[c.titel] || []
            }))
        }
      })
      .filter((mc): mc is NonNullable<typeof mc> => mc !== null)
      .sort((a, b) => a.order - b.order)

    return sortedMainCategories
  }, [availableEquipment, searchTerm, categories, mainCategories])

  const currentVacation = vacations.find(v => v.id === selectedVacationId)

  const handleGeneratePackingList = async (equipmentItems: EquipmentItem[]) => {
    if (!selectedVacationId || equipmentItems.length === 0) return

    const packlisteGegenstandIds = new Set(packingItems.map(p => p.gegenstand_id))
    const toAdd = equipmentItems.filter(eq => !packlisteGegenstandIds.has(eq.id))

    if (toAdd.length === 0) {
      alert('Alle ausgewählten Gegenstände sind bereits in der Packliste.')
      return
    }

    const vacationMitreisendeIds = vacationMitreisende.map(m => m.id)

    try {
      const results = await Promise.allSettled(
        toAdd.map((item) => {
          let mitreisendeIds: string[] | undefined
          if (item.mitreisenden_typ === 'alle') {
            mitreisendeIds = vacationMitreisendeIds
          } else if (item.mitreisenden_typ === 'ausgewaehlte' && item.standard_mitreisende?.length) {
            mitreisendeIds = item.standard_mitreisende
          }
          return fetch('/api/packing-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vacationId: selectedVacationId,
              gegenstandId: item.id,
              anzahl: item.standard_anzahl ?? 1,
              transportId: item.transport_id || null,
              mitreisende: mitreisendeIds,
            }),
          })
        })
      )

      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
      if (failed.length > 0) {
        console.error('Some items failed to add:', failed)
      }

      const res = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
      const data = await res.json()
      if (data.success) {
        setPackingItems(data.data)
      }
    } catch (error) {
      console.error('Failed to generate packing list:', error)
      throw error
    }
  }

  const handleSetPacked = async (itemId: string, gepackt: boolean) => {
    const prevItems = packingItems
    // Optimistic update: packingItems direkt aktualisieren → sofortige UI-Aktualisierung
    setPackingItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, gepackt } : item
      )
    )
    try {
      const res = await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, gepackt }),
      })
      const data = await res.json()
      if (!data.success) {
        setPackingItems(prevItems)
        alert('Fehler beim Aktualisieren')
      }
    } catch (error) {
      console.error('Failed to set packed:', error)
      setPackingItems(prevItems)
      alert('Fehler beim Aktualisieren')
    }
  }

  const handleTogglePacked = async (itemId: string) => {
    const item = packingItems.find(p => p.id === itemId)
    const isPacked = item?.gepackt ?? false
    const newPackedState = !isPacked
    const prevItems = packingItems

    // Optimistic update: packingItems direkt aktualisieren → Checkbox/Ausblenden sofort
    setPackingItems(prev =>
      prev.map(p =>
        p.id === itemId ? { ...p, gepackt: newPackedState } : p
      )
    )

    try {
      const res = await fetch('/api/packing-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, gepackt: newPackedState }),
      })
      const data = await res.json()
      if (!data.success) {
        setPackingItems(prevItems)
        alert('Fehler beim Aktualisieren')
      }
    } catch (error) {
      console.error('Failed to toggle packed:', error)
      setPackingItems(prevItems)
      alert('Fehler beim Aktualisieren')
    }
  }

  const handleToggleMitreisender = async (itemId: string, mitreisenderId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const prevItems = packingItems

    // Optimistic update: mitreisende-Eintrag in packingItems sofort aktualisieren
    setPackingItems(prev =>
      prev.map(p => {
        if (p.id !== itemId) return p
        const mitreisende = p.mitreisende ?? []
        const existingIdx = mitreisende.findIndex(m => m.mitreisender_id === mitreisenderId)
        let updatedMitreisende: typeof mitreisende
        if (existingIdx >= 0) {
          updatedMitreisende = mitreisende.map((m, i) =>
            i === existingIdx ? { ...m, gepackt: newStatus } : m
          )
        } else if (newStatus) {
          const name = vacationMitreisende.find(m => m.id === mitreisenderId)?.name ?? ''
          updatedMitreisende = [...mitreisende, { mitreisender_id: mitreisenderId, mitreisender_name: name, gepackt: true }]
        } else {
          return p
        }
        return { ...p, mitreisende: updatedMitreisende }
      })
    )

    try {
      const res = await fetch('/api/packing-items/toggle-mitreisender', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packingItemId: itemId,
          mitreisenderId,
          gepackt: newStatus
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setPackingItems(prevItems)
      }
    } catch (error) {
      console.error('Failed to toggle mitreisender:', error)
      setPackingItems(prevItems)
    }
  }

  const handleToggleMultipleMitreisende = async (packingItemId: string, updates: Array<{ mitreisenderId: string; newStatus: boolean }>) => {
    const prevItems = packingItems

    // Optimistic update für alle Änderungen
    setPackingItems(prev =>
      prev.map(p => {
        if (p.id !== packingItemId) return p
        const mitreisende = [...(p.mitreisende ?? [])]
        const updateMap = new Map(updates.map(u => [u.mitreisenderId, u.newStatus]))
        const updated = mitreisende.map(m => {
          const newStatus = updateMap.get(m.mitreisender_id)
          if (newStatus === undefined) return m
          return { ...m, gepackt: newStatus }
        })
        updates.forEach(u => {
          if (!updated.some(m => m.mitreisender_id === u.mitreisenderId) && u.newStatus) {
            const name = vacationMitreisende.find(m => m.id === u.mitreisenderId)?.name ?? ''
            updated.push({ mitreisender_id: u.mitreisenderId, mitreisender_name: name, gepackt: true })
          }
        })
        return { ...p, mitreisende: updated }
      })
    )

    try {
      for (const update of updates) {
        const res = await fetch('/api/packing-items/toggle-mitreisender', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packingItemId,
            mitreisenderId: update.mitreisenderId,
            gepackt: update.newStatus
          }),
        })
        const data = await res.json()
        if (!data.success) {
          setPackingItems(prevItems)
          return
        }
      }
    } catch (error) {
      console.error('Failed to toggle multiple mitreisende:', error)
      setPackingItems(prevItems)
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
          bemerkung: packingItemForm.bemerkung || null,
        }),
      })
      const data = await res.json()
      if (data.success && selectedVacationId) {
        // Refresh packing items
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setPackingItems(itemsData.data)
        }
        setShowEditItemDialog(false)
        setEditingPackingItemId(null)
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

  // FIXED: Change from body to URL parameter
  const handleDeletePackingItem = async (id: string) => {
    if (!confirm('Möchten Sie diesen Eintrag wirklich aus der Packliste entfernen?')) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/packing-items?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success && selectedVacationId) {
        // Refresh packing items
        const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
        const itemsData = await itemsRes.json()
        if (itemsData.success) {
          setPackingItems(itemsData.data)
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

  const handleToggleEquipmentSelection = (equipmentId: string) => {
    const newSelection = new Set(selectedEquipmentIds)
    if (newSelection.has(equipmentId)) {
      newSelection.delete(equipmentId)
    } else {
      newSelection.add(equipmentId)
    }
    setSelectedEquipmentIds(newSelection)
  }

  const handleAddSelectedEquipment = async () => {
    if (selectedEquipmentIds.size === 0 || !selectedVacationId) return

    setIsLoading(true)
    try {
      // Add all selected equipment items
      const promises = Array.from(selectedEquipmentIds).map(equipmentId => 
        fetch('/api/packing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacationId: selectedVacationId,
            gegenstandId: equipmentId,
            anzahl: 1,
            bemerkung: null,
            transportId: null,
            mitreisende: []
          }),
        })
      )

      await Promise.all(promises)

      // Refresh packing items
      const itemsRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
      const itemsData = await itemsRes.json()
      if (itemsData.success) {
        setPackingItems(itemsData.data)
      }

      // Close dialog and reset
      setShowAddItemDialog(false)
      setSelectedEquipmentIds(new Set())
      setSearchTerm('')
    } catch (error) {
      console.error('Failed to add equipment items:', error)
      alert('Fehler beim Hinzufügen der Gegenstände')
    } finally {
      setIsLoading(false)
    }
  }

  // Initialen: Bei Duplikaten (z.B. Luisa, Luca) 1.+3. Buchstabe nutzen
  const getInitials = (name: string) => {
    const getFirstTwo = (n: string) =>
      n.split(' ').map(p => p[0]).join('').toUpperCase().substring(0, 2)
    const firstTwo = getFirstTwo(name)
    const sameInitialsCount = vacationMitreisende.filter(
      m => getFirstTwo(m.name) === firstTwo
    ).length
    if (sameInitialsCount >= 2 && name.length >= 3) {
      return (name[0] ?? '').toUpperCase() + (name[2] ?? '').toUpperCase()
    }
    return firstTwo
  }

  return (
    <div className="min-h-screen bg-[rgb(250,250,249)] flex max-w-full overflow-x-hidden">
      {/* Navigation Sidebar (Links) */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 transition-all duration-300 min-w-0",
        "lg:ml-[280px]"
      )}>
        <div className="h-full min-w-0">
          {/* Vacation Selected */}
          {currentVacation && (
            <div className="h-full flex flex-col min-w-0">
              {/* Header - White background, horizontale Ränder für Mobile */}
              <div className="bg-white border-b min-w-0">
                <div className="py-3 px-4 flex items-center justify-between gap-3 min-w-0 w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Mobile Menu Toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowNavSidebar(true)}
                      className="lg:hidden flex-shrink-0"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                    
                    <div className="min-w-0 flex-1">
                      <h1 className="text-lg sm:text-xl font-bold text-[rgb(45,79,30)] truncate">
                        {currentVacation.titel}
                      </h1>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {new Date(currentVacation.startdatum).toLocaleDateString('de-DE')} - {new Date(currentVacation.enddatum).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>

                  {/* Pack Profile Button - Nur runder Kreis mit Initialen oder Alle-Symbol */}
                  {packingItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPackSettings(true)}
                      className="flex-shrink-0 p-0 border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgb(45,79,30)] focus:ring-offset-2 rounded-full"
                    >
                      <div className="h-8 w-8 rounded-full bg-[rgb(45,79,30)] text-white flex items-center justify-center text-xs font-bold">
                        {selectedPackProfile ? (
                          getInitials(vacationMitreisende.find(m => m.id === selectedPackProfile)?.name ?? '?')
                        ) : (
                          <Users className="h-4 w-4" />
                        )}
                      </div>
                    </button>
                  )}
                </div>

                {/* Packing List Component includes progress and tabs */}
                <PackingList
                  items={packingItems}
                  onToggle={handleTogglePacked}
                  onSetPacked={handleSetPacked}
                  onToggleMitreisender={handleToggleMitreisender}
                  onToggleMultipleMitreisende={handleToggleMultipleMitreisende}
                  onEdit={handleEditPackingItem}
                  onDelete={handleDeletePackingItem}
                  selectedProfile={selectedPackProfile}
                  hidePackedItems={hidePackedItems}
                  onOpenSettings={() => setShowPackSettings(true)}
                  vacationMitreisende={vacationMitreisende}
                />
              </div>

              {/* Auto-generate button - Only when list is empty */}
              {packingItems.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground mb-4">
                    Ihre Packliste ist leer. Generieren Sie automatisch Vorschläge oder fügen Sie manuell Gegenstände hinzu.
                  </p>
                  <Button 
                    onClick={() => setShowGeneratorDialog(true)}
                    size="lg"
                    className="bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Automatisch generieren
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* No Vacation Selected */}
          {!currentVacation && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground text-center">
                  Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub über die Navigation!
                </p>
              </CardContent>
            </Card>
          )}

          {/* Edit Item Dialog */}
          <ResponsiveModal
            open={showEditItemDialog}
            onOpenChange={setShowEditItemDialog}
            title="Packlisten-Eintrag bearbeiten"
            description="Anzahl und Bemerkung anpassen"
          >
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
          </ResponsiveModal>
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

      {/* FAB Button für Gegenstand hinzufügen - Kreisrund mit weißem Plus */}
      {currentVacation && (
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            size="icon"
            onClick={() => setShowAddItemDialog(true)}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </div>
      )}

      {/* Add Equipment Dialog - Drawer auf Mobile, Dialog auf Desktop */}
      <ResponsiveModal
        open={showAddItemDialog}
        onOpenChange={(open) => {
          setShowAddItemDialog(open)
          if (!open) {
            setSelectedEquipmentIds(new Set())
            setSearchTerm('')
          }
        }}
        title=""
        customContent
        contentClassName="max-w-4xl max-h-[90vh] sm:max-h-[90vh] h-[85vh] sm:h-auto flex flex-col"
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <h2 className="text-lg font-semibold">Gegenstände hinzufügen</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Wählen Sie Ausrüstungsgegenstände aus, die zur Packliste hinzugefügt werden sollen
            </p>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4 border-b flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Gegenständen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {selectedEquipmentIds.size} ausgewählt · {availableEquipment.length} verfügbar
            </div>
          </div>

          {/* Equipment List - Scrollable */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 min-w-0">
            {groupedAvailableEquipment.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? 'Keine Gegenstände gefunden' : 'Alle Gegenstände sind bereits auf der Packliste'}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedAvailableEquipment.map(mainGroup => (
                  <div key={mainGroup.id}>
                    {/* Main Category Header */}
                    <div className="bg-[rgb(45,79,30)] text-white px-4 py-2 rounded-t-lg font-bold">
                      {mainGroup.name}
                    </div>
                    
                    {/* Categories */}
                    {mainGroup.categories.map(category => (
                      <div key={category.id} className="border-x border-b last:rounded-b-lg">
                        {/* Category Header */}
                        <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">
                          {category.name} ({category.items.length})
                        </div>
                        
                        {/* Items */}
                        <div className="divide-y divide-gray-200 bg-white">
                          {category.items.map(item => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer min-w-0"
                              onClick={() => handleToggleEquipmentSelection(item.id)}
                            >
                              <Checkbox
                                checked={selectedEquipmentIds.has(item.id)}
                                onCheckedChange={() => handleToggleEquipmentSelection(item.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="font-medium truncate">{item.was}</div>
                                {item.details && (
                                  <div className="text-sm text-muted-foreground truncate">
                                    {item.details}
                                  </div>
                                )}
                              </div>
                              {item.einzelgewicht != null && (
                                <div className="text-sm text-muted-foreground flex-shrink-0">
                                  {formatWeight(item.einzelgewicht)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Sticky */}
          <div className="px-6 py-4 border-t bg-white flex gap-2 flex-shrink-0">
            <Button
              onClick={handleAddSelectedEquipment}
              disabled={selectedEquipmentIds.size === 0 || isLoading}
              className="flex-1 bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90"
            >
              {isLoading ? 'Wird hinzugefügt...' : `${selectedEquipmentIds.size} Gegenstand${selectedEquipmentIds.size !== 1 ? 'e' : ''} hinzufügen`}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowAddItemDialog(false)}
              disabled={isLoading}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </ResponsiveModal>

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

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[rgb(250,250,249)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgb(45,79,30)] mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
