'use client'

import { Layout } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PackingList } from '@/components/packing-list'
import { MitreisendeManager } from '@/components/mitreisende-manager'
import { CategoryManager } from '@/components/category-manager'
import { TravelersManager } from '@/components/travelers-manager'
import { TagManager } from '@/components/tag-manager'
import { PackingListGenerator } from '@/components/packing-list-generator'
import { Plus, Package, MapPin, Users, Trash2, Edit2, ChevronDown, Link as LinkIcon, X, FolderTree, UserCircle, Tag as TagIcon, Sparkles } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { Vacation, PackingItem, EquipmentItem, Category, TransportVehicle, Mitreisender, MainCategory, Tag } from '@/lib/db'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        mitreisendeIds = _vacationMitreisende.map(m => m.id)
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
  
  // fix: comment to force new commit and build
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
          <Dialog open={showNewVacationDialog} onOpenChange={(open) => {
            if (!open) {
              handleCloseVacationDialog()
            } else {
              setShowNewVacationDialog(true)
            }
          }}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Neuer Urlaub
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingVacationId ? 'Urlaub bearbeiten' : 'Neuen Urlaub erstellen'}
                </DialogTitle>
                <DialogDescription>
                  {editingVacationId ? 'Bearbeiten Sie die Details des Urlaubs' : 'Geben Sie die Details für Ihren neuen Urlaub ein'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="titel">Titel *</Label>
                  <Input
                    id="titel"
                    placeholder="z.B. Sommerurlaub 2024"
                    value={newVacationForm.titel}
                    onChange={(e) => setNewVacationForm({ ...newVacationForm, titel: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="reiseziel">Reiseziel *</Label>
                  <Input
                    id="reiseziel"
                    placeholder="z.B. Schwarzwald"
                    value={newVacationForm.reiseziel_name}
                    onChange={(e) => setNewVacationForm({ ...newVacationForm, reiseziel_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="reiseziel_adresse">Adresse</Label>
                  <Input
                    id="reiseziel_adresse"
                    placeholder="z.B. Campingplatz am See, 79822 Titisee"
                    value={newVacationForm.reiseziel_adresse}
                    onChange={(e) => setNewVacationForm({ ...newVacationForm, reiseziel_adresse: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="land_region">Land / Region</Label>
                  <Input
                    id="land_region"
                    placeholder="z.B. Deutschland, Baden-Württemberg"
                    value={newVacationForm.land_region}
                    onChange={(e) => setNewVacationForm({ ...newVacationForm, land_region: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="abfahrtdatum">Abreisedatum</Label>
                    <Input
                      id="abfahrtdatum"
                      type="date"
                      value={newVacationForm.abfahrtdatum}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, abfahrtdatum: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wann starten Sie von zuhause?
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="startdatum">Startdatum *</Label>
                    <Input
                      id="startdatum"
                      type="date"
                      value={newVacationForm.startdatum}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, startdatum: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="enddatum">Enddatum *</Label>
                    <Input
                      id="enddatum"
                      type="date"
                      value={newVacationForm.enddatum}
                      onChange={(e) => setNewVacationForm({ ...newVacationForm, enddatum: e.target.value })}
                    />
                  </div>
                </div>
                
                {/* Mitreisenden-Verwaltung */}
                <MitreisendeManager 
                  vacationId={editingVacationId}
                  onMitreisendeChange={setVacationMitreisende}
                />
                
                <Button onClick={handleCreateVacation} disabled={isLoading} className="w-full">
                  {isLoading ? 'Wird gespeichert...' : editingVacationId ? 'Urlaub aktualisieren' : 'Urlaub erstellen'}
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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="packing">
              <Package className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Packliste</span>
            </TabsTrigger>
            <TabsTrigger value="equipment">
              <MapPin className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Ausrüstung</span>
            </TabsTrigger>
            <TabsTrigger value="categories">
              <FolderTree className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Kategorien</span>
            </TabsTrigger>
            <TabsTrigger value="tags">
              <TagIcon className="h-4 w-4 mr-2" />
              Tags
            </TabsTrigger>
            <TabsTrigger value="travelers">
              <UserCircle className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Mitreisende</span>
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
                <div className="space-y-4">
                  {currentVacation && (
                    <div className="flex justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowGeneratorDialog(true)}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Automatisch generieren
                      </Button>

                      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Gegenstand hinzufügen
                          </Button>
                        </DialogTrigger>
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
                                    // Filter by search term
                                    const matchesSearch = item.was.toLowerCase().includes(equipmentSearchTerm.toLowerCase()) ||
                                      (item.kategorie_titel?.toLowerCase().includes(equipmentSearchTerm.toLowerCase()))
                                    // Exclude items already in packing list
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
                                        // Set transport from equipment default
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
                              <p className="text-xs text-muted-foreground mt-1">
                                Wo wird dieser Gegenstand transportiert?
                              </p>
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
                  {currentVacation ? (
                    <PackingList
                      items={packingItems}
                      onToggleItem={handleToggleItem}
                      onToggleMitreisender={handleToggleMitreisender}
                      onEditItem={handleEditPackingItem}
                      onDeleteItem={handleDeletePackingItem}
                      hidePackedItems={false}
                    />
                  ) : (
                    <p className="text-muted-foreground">Keine Urlaube vorhanden</p>
                  )}
                </div>
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
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                          <Label htmlFor="kategorie">Kategorie</Label>
                          <div className="relative">
                            <button
                              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                              className="w-full px-3 py-2 border border-input rounded-md bg-background text-left flex justify-between items-center hover:bg-accent"
                            >
                              <span>
                                {selectedCategory
                                  ? `${selectedCategory.hauptkategorie_titel} > ${selectedCategory.titel}`
                                  : 'Kategorie wählen...'}
                              </span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </button>
                            {showCategoryDropdown && (
                              <div className="absolute z-10 w-full mt-1 border border-input rounded-md bg-background shadow-md">
                                <Input
                                  placeholder="Suchen..."
                                  value={categorySearchTerm}
                                  onChange={(e) => setCategorySearchTerm(e.target.value)}
                                  className="border-0 border-b rounded-none"
                                />
                                <div className="max-h-64 overflow-y-auto">
                                  {Object.entries(groupedCategories).length === 0 ? (
                                    <div className="p-3 text-sm text-muted-foreground text-center">
                                      Keine Kategorien gefunden
                                    </div>
                                  ) : (
                                    Object.entries(groupedCategories).map(([mainCat, cats]) => (
                                      <div key={mainCat}>
                                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/50">
                                          {mainCat}
                                        </div>
                                        {cats.map(cat => (
                                          <button
                                            key={cat.id}
                                            onClick={() => {
                                              setNewEquipmentForm({ ...newEquipmentForm, kategorie_id: cat.id })
                                              setShowCategoryDropdown(false)
                                              setCategorySearchTerm('')
                                            }}
                                            className="w-full px-6 py-2 text-left text-sm hover:bg-accent transition-colors"
                                          >
                                            {cat.titel}
                                          </button>
                                        ))}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="transport">Transport-Standard</Label>
                          <select
                            id="transport"
                            value={newEquipmentForm.transport_id}
                            onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, transport_id: e.target.value })}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="">Kein Standard festgelegt</option>
                            {transportVehicles.map(vehicle => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Wo wird dieser Gegenstand normalerweise transportiert?
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="gewicht">Gewicht (kg)</Label>
                            <Input
                              id="gewicht"
                              placeholder="z.B. 2,5"
                              value={newEquipmentForm.einzelgewicht}
                              onChange={(e) => {
                                let value = e.target.value
                                // Allow only digits and comma
                                value = value.replace(/[^\d,]/g, '')
                                // Prevent multiple commas
                                const parts = value.split(',')
                                if (parts.length > 2) {
                                  value = parts[0] + ',' + parts.slice(1).join('')
                                }
                                setNewEquipmentForm({ ...newEquipmentForm, einzelgewicht: value })
                              }}
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
                            <option value="Normal">Normal</option>
                            <option value="Immer gepackt">Immer gepackt</option>
                            <option value="Fest Installiert">Fest Installiert</option>
                            <option value="Ausgemustert">Ausgemustert</option>
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

                        {/* Standard-Flag */}
                        <div className="flex items-center space-x-2 p-3 border rounded-lg bg-yellow-50">
                          <input
                            type="checkbox"
                            id="is-standard"
                            checked={newEquipmentForm.is_standard}
                            onChange={(e) => setNewEquipmentForm({ ...newEquipmentForm, is_standard: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label htmlFor="is-standard" className="text-sm cursor-pointer flex items-center gap-2">
                            <span className="text-lg">⭐</span>
                            <div>
                              <div className="font-medium">Als Standard markieren</div>
                              <div className="text-xs text-muted-foreground">
                                Wird bei automatischer Packlisten-Generierung immer vorgeschlagen
                              </div>
                            </div>
                          </label>
                        </div>

                        {/* Tags */}
                        <div>
                          <Label>Tags für Packlisten-Generierung</Label>
                          <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                            {tags.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-2">
                                Keine Tags vorhanden. Erstellen Sie zuerst Tags im Tab &quot;Tags&quot;.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {tags.map((tag) => (
                                  <div key={tag.id} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id={`tag-${tag.id}`}
                                      checked={newEquipmentForm.tags.includes(tag.id)}
                                      onChange={(e) => {
                                        const newTags = e.target.checked
                                          ? [...newEquipmentForm.tags, tag.id]
                                          : newEquipmentForm.tags.filter(id => id !== tag.id)
                                        setNewEquipmentForm({ ...newEquipmentForm, tags: newTags })
                                      }}
                                      className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label htmlFor={`tag-${tag.id}`} className="text-sm cursor-pointer flex items-center gap-1">
                                      <span
                                        className="w-3 h-3 rounded-full inline-block"
                                        style={{ backgroundColor: tag.farbe || '#3b82f6' }}
                                      />
                                      {tag.icon && <span>{tag.icon}</span>}
                                      {tag.titel}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Tags helfen bei der automatischen Generierung von Packlisten (z.B. Sommer, Strand, Feuerküche)
                          </p>
                        </div>
                        
                        {/* Mitreisenden-Typ */}
                        <div>
                          <Label htmlFor="mitreisenden-typ">Für wen gilt dieser Gegenstand?</Label>
                          <select
                            id="mitreisenden-typ"
                            value={newEquipmentForm.mitreisenden_typ}
                            onChange={(e) => setNewEquipmentForm({ 
                              ...newEquipmentForm, 
                              mitreisenden_typ: e.target.value as 'pauschal' | 'alle' | 'ausgewaehlte',
                              standard_mitreisende: e.target.value === 'ausgewaehlte' ? newEquipmentForm.standard_mitreisende : []
                            })}
                            className="w-full px-3 py-2 border border-input rounded-md bg-background"
                          >
                            <option value="pauschal">Pauschal (gemeinsam für alle)</option>
                            <option value="alle">Für jeden Mitreisenden separat</option>
                            <option value="ausgewaehlte">Nur für ausgewählte Mitreisende</option>
                          </select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {newEquipmentForm.mitreisenden_typ === 'pauschal' && 'Wird einmal für den gesamten Urlaub gepackt (z.B. Gasflasche)'}
                            {newEquipmentForm.mitreisenden_typ === 'alle' && 'Jeder Mitreisende muss separat packen und abhaken (z.B. Kleidung, Kosmetik)'}
                            {newEquipmentForm.mitreisenden_typ === 'ausgewaehlte' && 'Nur bestimmte Personen müssen packen (z.B. Kontaktlinsen, Spielzeug)'}
                          </p>
                        </div>
                        
                        {/* Standard-Mitreisende (nur bei "ausgewählte") */}
                        {newEquipmentForm.mitreisenden_typ === 'ausgewaehlte' && (
                          <div>
                            <Label>Standard-Mitreisende</Label>
                            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                              {allMitreisende.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                  Noch keine Mitreisenden angelegt
                                </p>
                              ) : (
                                allMitreisende.map((mitreisender) => (
                                  <div key={mitreisender.id} className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      id={`std-mitreisender-${mitreisender.id}`}
                                      checked={newEquipmentForm.standard_mitreisende.includes(mitreisender.id)}
                                      onChange={(e) => {
                                        const newSelection = e.target.checked
                                          ? [...newEquipmentForm.standard_mitreisende, mitreisender.id]
                                          : newEquipmentForm.standard_mitreisende.filter(id => id !== mitreisender.id)
                                        setNewEquipmentForm({ ...newEquipmentForm, standard_mitreisende: newSelection })
                                      }}
                                      className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label
                                      htmlFor={`std-mitreisender-${mitreisender.id}`}
                                      className="text-sm cursor-pointer"
                                    >
                                      {mitreisender.name}
                                    </label>
                                  </div>
                                ))
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Diese Mitreisenden werden standardmäßig zugeordnet, wenn der Gegenstand zur Packliste hinzugefügt wird
                            </p>
                          </div>
                        )}
                        
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <Label>Links</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleAddLink}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Link hinzufügen
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {newEquipmentForm.links.map((link, index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  placeholder="https://..."
                                  value={link}
                                  onChange={(e) => handleLinkChange(index, e.target.value)}
                                />
                                {newEquipmentForm.links.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveLink(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Fügen Sie Links zu Produktseiten, Anleitungen oder Komponenten hinzu
                          </p>
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
                            <CardDescription className="text-xs space-y-1">
                              <div>{item.status}</div>
                              {item.transport_name && (
                                <div className="text-xs">🚗 {item.transport_name}</div>
                              )}
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
                          <p><span className="font-medium">Gewicht:</span> {formatGermanNumber(item.einzelgewicht)} kg</p>
                        )}
                        <p><span className="font-medium">Standard-Anzahl:</span> {item.standard_anzahl}</p>
                        {item.details && (
                          <p><span className="font-medium">Details:</span> {item.details}</p>
                        )}
                        {item.links && item.links.length > 0 && (
                          <div>
                            <span className="font-medium">Links:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.links.map((link, idx) => (
                                <a
                                  key={link.id}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                  Link {idx + 1}
                                </a>
                              ))}
                            </div>
                          </div>
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

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
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
                    // Refresh categories
                    const catRes = await fetch('/api/categories')
                    const catData = await catRes.json()
                    if (catData.success) setCategories(catData.data)
                    
                    // Refresh main categories
                    const mainCatRes = await fetch('/api/main-categories')
                    const mainCatData = await mainCatRes.json()
                    if (mainCatData.success) setMainCategories(mainCatData.data)
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags">
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
          </TabsContent>

          {/* Travelers Tab */}
          <TabsContent value="travelers" className="space-y-4">
            <TravelersManager
              travelers={allMitreisende}
              onRefresh={async () => {
                // Refresh all mitreisende
                const res = await fetch('/api/mitreisende')
                const data = await res.json()
                if (data.success) setAllMitreisende(data.data)
              }}
            />
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
                      <Button variant="outline" size="sm">
                        Packliste öffnen
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {/* Packing List Generator Dialog */}
      <PackingListGenerator
        open={showGeneratorDialog}
        onOpenChange={setShowGeneratorDialog}
        vacationId={selectedVacationId || ''}
        onGenerate={handleGeneratePackingList}
      />
    </Layout>
  )
}
