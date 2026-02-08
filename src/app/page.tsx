'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
//import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list-enhanced'
import { MitreisendeManager } from '@/components/mitreisende-manager'
import { CategoryManager } from '@/components/category-manager'
import { TravelersManager } from '@/components/travelers-manager'
import { TagManager } from '@/components/tag-manager'
import { PackingListGenerator } from '@/components/packing-list-generator'
import { Plus, Package, MapPin, Users, Trash2, Edit2, ChevronDown, Link as _LinkIcon, X, FolderTree, UserCircle, Tag as TagIcon, Sparkles } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { Vacation, PackingItem, EquipmentItem, Category, TransportVehicle, Mitreisender, MainCategory, Tag } from '@/lib/db'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EquipmentTable } from '@/components/equipment-table'
import { PackingSettingsSidebar } from '@/components/packing-settings-sidebar'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { Menu, Users2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

export default function Home() {
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [packingItems, setPackingItems] = useState<PackingItem[]>([])
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [allMitreisende, setAllMitreisende] = useState<Mitreisender[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [vacationMitreisende, setVacationMitreisende] = useState<Mitreisender[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string | null>(null)
  const [packedItems, setPackedItems] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [showNewVacationDialog, setShowNewVacationDialog] = useState(false)
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  const [showGeneratorDialog, setShowGeneratorDialog] = useState(false)
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null)
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null)
  const [editingPackingItemId, setEditingPackingItemId] = useState<string | null>(null)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('')
  const [selectedPackProfile, setSelectedPackProfile] = useState<string | null>(null)
  const [hidePackedItems, setHidePackedItems] = useState(false)
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [showPackSettings, setShowPackSettings] = useState(false)
  const [packingItemForm, setPackingItemForm] = useState({
    gegenstandId: '',
    anzahl: '1',
    bemerkung: '',
    transportId: ''
  })
  const [newVacationForm, setNewVacationForm] = useState({
    titel: '',
    startdatum: '',
    abfahrtdatum: '',
    enddatum: '',
    reiseziel_name: '',
    reiseziel_adresse: '',
    land_region: ''
  })
  const [newEquipmentForm, setNewEquipmentForm] = useState({
    was: '',
    kategorie_id: '',
    transport_id: '',
    einzelgewicht: '',
    standard_anzahl: '1',
    status: 'Immer gepackt',
    details: '',
    is_standard: false,
    tags: [] as string[],
    links: [''],
    mitreisenden_typ: 'pauschal' as 'pauschal' | 'alle' | 'ausgewaehlte',
    standard_mitreisende: [] as string[]
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

  // Fetch All Mitreisende
  useEffect(() => {
    const fetchAllMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = await res.json()
        if (data.success) {
          setAllMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
      }
    }
    fetchAllMitreisende()
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
      }
    }
    fetchTags()
  }, [])

  // Filter categories based on search term
  const filteredCategories = useMemo(() => {
    if (!categorySearchTerm) return categories
    const term = categorySearchTerm.toLowerCase()
    return categories.filter(cat =>
      cat.titel.toLowerCase().includes(term) ||
      cat.hauptkategorie_titel.toLowerCase().includes(term)
    )
  }, [categories, categorySearchTerm])

  // Group categories by main category
  const groupedCategories = useMemo(() => {
    const grouped: Record<string, CategoryWithMain[]> = {}
    filteredCategories.forEach(cat => {
      const title = cat.hauptkategorie_titel
      if (!grouped[title]) {
        grouped[title] = []
      }
      // Use a non-null assertion or a safe push
      const group = grouped[title]
      if (group) {
        group.push(cat)
      }
    })
    return grouped
  }, [filteredCategories])

  const selectedCategory = categories.find(c => c.id === newEquipmentForm.kategorie_id)

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

  const handleAddPackingItem = async () => {
    if (!packingItemForm.gegenstandId || !selectedVacationId) {
      alert('Bitte wählen Sie einen Gegenstand aus')
      return
    }

    // Find the selected equipment item to get mitreisenden_typ and standard_mitreisende
    const selectedEquipment = equipmentItems.find(item => item.id === packingItemForm.gegenstandId)
    let mitreisendeIds: string[] = []
    
    if (selectedEquipment) {
      if (selectedEquipment.mitreisenden_typ === 'alle') {
        // Use all mitreisende from the vacation
        mitreisendeIds = vacationMitreisende.map(m => m.id)
      } else if (selectedEquipment.mitreisenden_typ === 'ausgewaehlte') {
        // Use standard_mitreisende from the equipment item
        mitreisendeIds = selectedEquipment.standard_mitreisende || []
      }
      // For 'pauschal', mitreisendeIds remains empty
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
          mitreisende: mitreisendeIds
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
        setEquipmentSearchTerm('')
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
      const res = await fetch(`/api/packing-items?id=${id}`, {
        method: 'DELETE'
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

  const handleCreateVacation = async () => {
    if (!newVacationForm.titel || !newVacationForm.startdatum || !newVacationForm.enddatum || !newVacationForm.reiseziel_name) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const method = editingVacationId ? 'PUT' : 'POST'
      const body = editingVacationId
        ? { ...newVacationForm, id: editingVacationId }
        : newVacationForm

      const res = await fetch('/api/vacations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        if (editingVacationId) {
          setVacations(vacations.map(v => v.id === editingVacationId ? data.data : v))
        } else {
          // New vacation created - assign selected travelers
          const newVacationId = data.data.id
          
          if (vacationMitreisende.length > 0) {
            // Assign selected travelers to the new vacation
            const selectedIds = vacationMitreisende.map(m => m.id)
            await fetch('/api/mitreisende', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vacationId: newVacationId,
                mitreisendeIds: selectedIds
              })
            })
          }
          
          setVacations([...vacations, data.data])
          setSelectedVacationId(newVacationId)
        }
        setShowNewVacationDialog(false)
        setEditingVacationId(null)
        setNewVacationForm({
          titel: '',
          startdatum: '',
          abfahrtdatum: '',
          enddatum: '',
          reiseziel_name: '',
          reiseziel_adresse: '',
          land_region: ''
        })
      } else {
        alert('Fehler beim Speichern des Urlaubs: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to save vacation:', error)
      alert('Fehler beim Speichern des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditVacation = (vacation: Vacation) => {
    setEditingVacationId(vacation.id)
    setNewVacationForm({
      titel: vacation.titel,
      startdatum: vacation.startdatum,
      abfahrtdatum: vacation.abfahrtdatum || '',
      enddatum: vacation.enddatum,
      reiseziel_name: vacation.reiseziel_name,
      reiseziel_adresse: vacation.reiseziel_adresse || '',
      land_region: vacation.land_region || ''
    })
    setShowNewVacationDialog(true)
  }

  const handleCloseVacationDialog = () => {
    setShowNewVacationDialog(false)
    setEditingVacationId(null)
    setNewVacationForm({
      titel: '',
      startdatum: '',
      abfahrtdatum: '',
      enddatum: '',
      reiseziel_name: '',
      reiseziel_adresse: '',
      land_region: ''
    })
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

  // Convert German number format (comma) to English format (dot) for storage
  const parseGermanNumber = (value: string): number | null => {
    if (!value) return null
    const normalized = value.replace(/\./g, '').replace(/,/g, '.')
    const parsed = parseFloat(normalized)
    return isNaN(parsed) ? null : parsed
  }

  // Format number to German format
  const formatGermanNumber = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value)
  }

  const handleAddLink = () => {
    setNewEquipmentForm({
      ...newEquipmentForm,
      links: [...newEquipmentForm.links, '']
    })
  }

  const handleRemoveLink = (index: number) => {
    const newLinks = newEquipmentForm.links.filter((_, i) => i !== index)
    setNewEquipmentForm({
      ...newEquipmentForm,
      links: newLinks.length > 0 ? newLinks : ['']
    })
  }

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...newEquipmentForm.links]
    newLinks[index] = value
    setNewEquipmentForm({
      ...newEquipmentForm,
      links: newLinks
    })
  }

  const handleCreateEquipment = async () => {
    if (!newEquipmentForm.was || !newEquipmentForm.kategorie_id) {
      alert('Bitte füllen Sie alle erforderlichen Felder aus')
      return
    }

    setIsLoading(true)
    try {
      const einzelgewicht = newEquipmentForm.einzelgewicht 
        ? parseGermanNumber(newEquipmentForm.einzelgewicht)
        : null

      // Filter out empty links
      const validLinks = newEquipmentForm.links.filter(link => link.trim() !== '')

      const method = editingEquipmentId ? 'PUT' : 'POST'
      const body = editingEquipmentId
        ? {
            ...newEquipmentForm,
            id: editingEquipmentId,
            transport_id: newEquipmentForm.transport_id || null,
            einzelgewicht,
            standard_anzahl: parseInt(newEquipmentForm.standard_anzahl),
            links: validLinks,
            mitreisenden_typ: newEquipmentForm.mitreisenden_typ,
            standard_mitreisende: newEquipmentForm.standard_mitreisende
          }
        : {
            ...newEquipmentForm,
            transport_id: newEquipmentForm.transport_id || null,
            einzelgewicht,
            standard_anzahl: parseInt(newEquipmentForm.standard_anzahl),
            links: validLinks,
            mitreisenden_typ: newEquipmentForm.mitreisenden_typ,
            standard_mitreisende: newEquipmentForm.standard_mitreisende
          }

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
          transport_id: '',
          einzelgewicht: '',
          standard_anzahl: '1',
          status: 'Immer gepackt',
          details: '',
          is_standard: false,
          tags: [] as string[],
          links: [''],
          mitreisenden_typ: 'pauschal' as 'pauschal' | 'alle' | 'ausgewaehlte',
          standard_mitreisende: [] as string[]
        })
        setCategorySearchTerm('')
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
      transport_id: item.transport_id || '',
      einzelgewicht: item.einzelgewicht ? formatGermanNumber(item.einzelgewicht) : '',
      standard_anzahl: item.standard_anzahl.toString(),
      status: item.status,
      details: item.details || '',
      is_standard: item.is_standard || false,
      tags: item.tags ? item.tags.map(t => t.id) : [],
      links: item.links && item.links.length > 0 ? item.links.map(l => l.url) : [''],
      mitreisenden_typ: item.mitreisenden_typ || 'pauschal',
      standard_mitreisende: item.standard_mitreisende || []
    })
    setCategorySearchTerm('')
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

  const handleGeneratePackingList = async (equipmentIds: string[]) => {
    if (!selectedVacationId) return

    setIsLoading(true)
    try {
      // Get default travelers for the vacation
      const defaultTravelersRes = await fetch(`/api/mitreisende?vacationId=${selectedVacationId}`)
      const defaultTravelersData = await defaultTravelersRes.json()
      const defaultTravelers = defaultTravelersData.success ? defaultTravelersData.data : []

      // Create packing items for each equipment item
      for (const equipmentId of equipmentIds) {
        const equipment = equipmentItems.find(e => e.id === equipmentId)
        if (!equipment) continue

        // Determine mitreisende based on equipment settings
        let mitreisende: string[] = []
        if (equipment.mitreisenden_typ === 'alle') {
          mitreisende = defaultTravelers.map((m: Mitreisender) => m.id)
        } else if (equipment.mitreisenden_typ === 'ausgewaehlte' && equipment.standard_mitreisende) {
          mitreisende = equipment.standard_mitreisende
        }

        const res = await fetch('/api/packing-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vacationId: selectedVacationId,
            gegenstandId: equipmentId,
            anzahl: equipment.standard_anzahl || 1,
            bemerkung: '',
            transportId: equipment.transport_id || null,
            mitreisende
          })
        })

        if (!res.ok) {
          console.error(`Failed to add equipment ${equipment.was}`)
        }
      }

      // Refresh packing items
      const refreshRes = await fetch(`/api/packing-items?vacationId=${selectedVacationId}`)
      const refreshData = await refreshRes.json()
      if (refreshData.success) {
        setPackingItems(refreshData.data)
      }

      alert(`${equipmentIds.length} Gegenstände zur Packliste hinzugefügt!`)
    } catch (error) {
      console.error('Failed to generate packing list:', error)
      alert('Fehler beim Generieren der Packliste')
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
      transport_id: '',
      einzelgewicht: '',
      standard_anzahl: '1',
      status: 'Immer gepackt',
      details: '',
      is_standard: false,
      tags: [] as string[],
      links: [''],
      mitreisenden_typ: 'pauschal' as 'pauschal' | 'alle' | 'ausgewaehlte',
      standard_mitreisende: [] as string[]
    })
    setCategorySearchTerm('')
  }

  const PacklisteView = () => {
    const currentVacation = vacations.find(v => v.id === selectedVacationId)
    
    if (!currentVacation) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub!
            </p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        {/* Automatisch generieren Button - nur wenn Liste leer */}
        {packingItems.length === 0 && (
          <Card className="border-dashed">
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

        {/* Packing List */}
        {packingItems.length > 0 && (
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

        {/* Add Item Dialog Content */}
        <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gegenstand zur Packliste hinzufügen</DialogTitle>
              <DialogDescription>
                Wählen Sie einen Gegenstand aus Ihrer Ausrüstung
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="equipment-search">Gegenstand suchen</Label>
                <Input
                  id="equipment-search"
                  placeholder="Suchen..."
                  value={equipmentSearchTerm}
                  onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                />
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                  {equipmentItems
                    .filter(item => {
                      const matchesSearch = item.was.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                        (item.kategorie_titel?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()))
                      const notInPackingList = !packingItems.some(pi => pi.gegenstand_id === item.id)
                      return matchesSearch && notInPackingList
                    })
                    .slice(0, 10)
                    .map(item => (
                      <div
                        key={item.id}
                        className={`p-2 cursor-pointer hover:bg-muted ${
                          packingItemForm.gegenstandId === item.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => {
                          setPackingItemForm({ 
                            ...packingItemForm, 
                            gegenstandId: item.id,
                            transportId: item.transport_id || ''
                          })
                        }}
                      >
                        <div className="text-sm font-medium">{item.was}</div>
                        <div className="text-xs text-muted-foreground">{item.kategorie_titel}</div>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <Label htmlFor="anzahl">Anzahl</Label>
                <Input
                  id="anzahl"
                  type="number"
                  min="1"
                  value={packingItemForm.anzahl}
                  onChange={(e) => setPackingItemForm({ ...packingItemForm, anzahl: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="transport">Transport</Label>
                <select
                  id="transport"
                  value={packingItemForm.transportId}
                  onChange={(e) => setPackingItemForm({ ...packingItemForm, transportId: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="">Nicht festgelegt</option>
                  {transportVehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="bemerkung">Bemerkung (optional)</Label>
                <Input
                  id="bemerkung"
                  placeholder="z.B. nur für Wanderungen"
                  value={packingItemForm.bemerkung}
                  onChange={(e) => setPackingItemForm({ ...packingItemForm, bemerkung: e.target.value })}
                />
              </div>
              <Button onClick={handleAddPackingItem} disabled={isLoading} className="w-full">
                {isLoading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  const AusruestungView = () => {
    return (
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
              {/* Equipment Dialog Content - kopiere aus der alten page.tsx */}
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <EquipmentTable
            equipmentItems={equipmentItems}
            categories={categories}
            mainCategories={mainCategories}
            transportVehicles={transportVehicles}
            tags={tags}
            onEdit={handleEditEquipment}
            onDelete={handleDeleteEquipment}
          />
        </CardContent>
      </Card>
    )
  }

  const UrlaubeView = () => {
    return (
      <div className="grid gap-4">
        {vacations.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub!
              </p>
            </CardContent>
          </Card>
        ) : (
          vacations.map((vacation) => (
            <Card
              key={vacation.id}
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                selectedVacationId === vacation.id && "ring-2 ring-primary"
              )}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle>{vacation.titel}</CardTitle>
                    <CardDescription>
                      <div className="space-y-1 mt-2">
                        {vacation.reiseziel_name && <p>📍 {vacation.reiseziel_name}</p>}
                        {vacation.reiseziel_adresse && <p>📍 {vacation.reiseziel_adresse}</p>}
                        {vacation.land_region && <p>🌍 {vacation.land_region}</p>}
                        {vacation.abfahrtdatum && <p>🚗 Abreise: {vacation.abfahrtdatum}</p>}
                        <p>📅 {vacation.startdatum} bis {vacation.enddatum}</p>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditVacation(vacation)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
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
                </div>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  size="sm"
                >
                  Packliste öffnen
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    )
  }

  const KonfigurationView = () => {
    const [configTab, setConfigTab] = useState<'kategorien' | 'tags' | 'mitreisende'>('kategorien')
    
    return (
      <div className="space-y-6">
        {/* Simple Tab Navigation */}
        <div className="flex gap-2 border-b">
          <Button
            variant={configTab === 'kategorien' ? 'default' : 'ghost'}
            onClick={() => setConfigTab('kategorien')}
          >
            Kategorien
          </Button>
          <Button
            variant={configTab === 'tags' ? 'default' : 'ghost'}
            onClick={() => setConfigTab('tags')}
          >
            Tags
          </Button>
          <Button
            variant={configTab === 'mitreisende' ? 'default' : 'ghost'}
            onClick={() => setConfigTab('mitreisende')}
          >
            Mitreisende
          </Button>
        </div>

        {/* Tab Content */}
        {configTab === 'kategorien' && (
          <Card>
            <CardHeader>
              <CardTitle>Kategorien verwalten</CardTitle>
              <CardDescription>
                Verwalten Sie Hauptkategorien und Kategorien für Ihre Ausrüstungsgegenstände
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryManager
                categories={categories}
                mainCategories={mainCategories}
                onRefresh={async () => {
                  const catRes = await fetch('/api/categories')
                  const catData = await catRes.json()
                  if (catData.success) setCategories(catData.data)
                  
                  const mainCatRes = await fetch('/api/main-categories')
                  const mainCatData = await mainCatRes.json()
                  if (mainCatData.success) setMainCategories(mainCatData.data)
                }}
              />
            </CardContent>
          </Card>
        )}

        {configTab === 'tags' && (
          <TagManager 
            tags={tags} 
            onRefresh={() => {
              fetch('/api/tags')
                .then(res => res.json())
                .then(data => {
                  if (data.success) {
                    setTags(data.data)
                  }
                })
            }} 
          />
        )}

        {configTab === 'mitreisende' && (
          <TravelersManager
            travelers={allMitreisende}
            onRefresh={async () => {
              const res = await fetch('/api/mitreisende')
              const data = await res.json()
              if (data.success) setAllMitreisende(data.data)
            }}
          />
        )}
      </div>
    )
  }

  const currentVacation = vacations.find(v => v.id === selectedVacationId)
  const totalItems = packingItems.length
  const packedCount = packedItems.size
  const packingPercentage = totalItems > 0 ? Math.round((packedCount / totalItems) * 100) : 0

  return (
    <div className="min-h-screen bg-background flex">
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
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          {/* Header mit Toggle-Buttons */}
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
                  Aktuelle Packliste
                </h1>
                <p className="text-muted-foreground mt-1">
                  {currentVacation?.titel || 'Kein Urlaub ausgewählt'}
                </p>
              </div>
            </div>

            {/* Pack Profile Toggle */}
            {currentVacation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPackSettings(true)}
                className="flex items-center gap-2"
              >
                <Users2 className="h-4 w-4" />
                <span className="hidden sm:inline">Pack-Profil</span>
              </Button>
            )}
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
            <div className="space-y-6">
              {/* Automatisch generieren Button - nur wenn Liste leer */}
              {packingItems.length === 0 && (
                <Card className="border-dashed">
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

              {/* Packing List */}
              {packingItems.length > 0 && (
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

              {/* Add Item Dialog */}
              <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Gegenstand zur Packliste hinzufügen</DialogTitle>
                    <DialogDescription>
                      Wählen Sie einen Gegenstand aus Ihrer Ausrüstung
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="equipment-search">Gegenstand suchen</Label>
                      <Input
                        id="equipment-search"
                        placeholder="Suchen..."
                        value={equipmentSearchTerm}
                        onChange={(e) => setEquipmentSearchTerm(e.target.value)}
                      />
                      <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                        {equipmentItems
                          .filter(item => {
                            const matchesSearch = item.was.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                              (item.kategorie_titel?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()))
                            const notInPackingList = !packingItems.some(pi => pi.gegenstand_id === item.id)
                            return matchesSearch && notInPackingList
                          })
                          .slice(0, 10)
                          .map(item => (
                            <div
                              key={item.id}
                              className={`p-2 cursor-pointer hover:bg-muted ${
                                packingItemForm.gegenstandId === item.id ? 'bg-muted' : ''
                              }`}
                              onClick={() => {
                                setPackingItemForm({ 
                                  ...packingItemForm, 
                                  gegenstandId: item.id,
                                  transportId: item.transport_id || ''
                                })
                              }}
                            >
                              <div className="text-sm font-medium">{item.was}</div>
                              <div className="text-xs text-muted-foreground">{item.kategorie_titel}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="anzahl">Anzahl</Label>
                      <Input
                        id="anzahl"
                        type="number"
                        min="1"
                        value={packingItemForm.anzahl}
                        onChange={(e) => setPackingItemForm({ ...packingItemForm, anzahl: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="transport">Transport</Label>
                      <select
                        id="transport"
                        value={packingItemForm.transportId}
                        onChange={(e) => setPackingItemForm({ ...packingItemForm, transportId: e.target.value })}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      >
                        <option value="">Nicht festgelegt</option>
                        {transportVehicles.map(vehicle => (
                          <option key={vehicle.id} value={vehicle.id}>
                            {vehicle.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="bemerkung">Bemerkung (optional)</Label>
                      <Input
                        id="bemerkung"
                        placeholder="z.B. nur für Wanderungen"
                        value={packingItemForm.bemerkung}
                        onChange={(e) => setPackingItemForm({ ...packingItemForm, bemerkung: e.target.value })}
                      />
                    </div>
                    <Button onClick={handleAddPackingItem} disabled={isLoading} className="w-full">
                      {isLoading ? 'Wird hinzugefügt...' : 'Hinzufügen'}
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
          <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}

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