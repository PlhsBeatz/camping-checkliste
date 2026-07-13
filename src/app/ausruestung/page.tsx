'use client'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { EquipmentTable } from '@/components/equipment-table'
import { EquipmentItemFormFields } from '@/components/equipment/equipment-item-form-fields'
import { Plus, Menu } from 'lucide-react'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag, TagKategorie, Mitreisender } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { type CategorySelectScrollTarget } from '@/components/category-select-grouped'
import { cn } from '@/lib/utils'
import {
  buildEquipmentApiPayload,
  buildTagGroupsForEquipment,
  createDefaultEquipmentFormValues,
  equipmentFormValuesFromItem,
  mitreisendenZeileAusApi,
  type EquipmentFormValues,
  type MitreisendenZeile,
} from '@/lib/equipment-form'
import {
  getCachedEquipment,
  getCachedCategories,
  getCachedMainCategories,
  getCachedTransportVehicles,
  getCachedTags,
  getCachedTagKategorien,
  getCachedMitreisende,
  notifyEquipmentChanged,
} from '@/lib/offline-sync'
import {
  cacheEquipment,
  cacheCategories,
  cacheMainCategories,
  cacheTransportVehicles,
  cacheTags,
  cacheTagKategorien,
  cacheMitreisende,
} from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

export default function AusruestungPage() {
  const { canAccessConfig } = useAuth()
  const canEditEquipment = canAccessConfig
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([])
  const [categories, setCategories] = useState<CategoryWithMain[]>([])
  const [mainCategories, setMainCategories] = useState<MainCategory[]>([])
  const [transportVehicles, setTransportVehicles] = useState<TransportVehicle[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tagKategorien, setTagKategorien] = useState<TagKategorie[]>([])
  const [mitreisende, setMitreisende] = useState<MitreisendenZeile[]>([])
  /** Aufklapp-Zustand für die zusätzlichen Mitreisenden-Zeilen (Individuell) */
  const [individuelleMitreisendeExtraOffen, setIndividuelleMitreisendeExtraOffen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  // Bump-Counter, der bei Reconnect alle useEffects (mit Cache-Befüllung) neu auslöst.
  const [refetchTick, setRefetchTick] = useState(0)
  useReconnectRefetch(() => setRefetchTick((t) => t + 1))
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null)
  const [deleteEquipmentId, setDeleteEquipmentId] = useState<string | null>(null)
  const equipmentVisibleSectionRef = useRef<{ mainTitle: string | null; categoryId: string | null }>({
    mainTitle: null,
    categoryId: null,
  })
  const handleEquipmentVisibleSection = useCallback((ctx: { mainTitle: string | null; categoryId: string | null }) => {
    equipmentVisibleSectionRef.current = ctx
  }, [])
  const syncEquipmentSnapshot = useCallback(async (items: EquipmentItem[]) => {
    setEquipmentItems(items)
    await cacheEquipment(items)
    notifyEquipmentChanged()
  }, [])
  const deleteEquipmentTarget = deleteEquipmentId
    ? equipmentItems.find((item) => item.id === deleteEquipmentId)
    : null
  const [addEquipmentCategoryScrollTarget, setAddEquipmentCategoryScrollTarget] =
    useState<CategorySelectScrollTarget | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<EquipmentFormValues>(createDefaultEquipmentFormValues())

  // Sidebar offen: Body-Scroll sperren
  useEffect(() => {
    if (showNavSidebar) {
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [showNavSidebar])

  // Fetch Equipment Items
  useEffect(() => {
    const fetchEquipmentItems = async () => {
      try {
        const res = await fetch('/api/equipment-items')
        const data = (await res.json()) as ApiResponse<EquipmentItem[]>
        if (data.success && data.data) {
          setEquipmentItems(data.data)
          await cacheEquipment(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch equipment items:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedEquipment()
          if (cached.length > 0) setEquipmentItems(cached)
        }
      } finally {
        setIsLoading(false)
      }
    }
    fetchEquipmentItems()
  }, [refetchTick])
  // Fetch Categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories')
        const data = (await res.json()) as ApiResponse<CategoryWithMain[]>
        if (data.success && data.data) {
          setCategories(data.data)
          await cacheCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedCategories()
          if (cached.length > 0) setCategories(cached as CategoryWithMain[])
        }
      }
    }
    fetchCategories()
  }, [refetchTick])

  // Fetch Main Categories
  useEffect(() => {
    const fetchMainCategories = async () => {
      try {
        const res = await fetch('/api/main-categories')
        const data = (await res.json()) as ApiResponse<MainCategory[]>
        if (data.success && data.data) {
          setMainCategories(data.data)
          await cacheMainCategories(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch main categories:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedMainCategories()
          if (cached.length > 0) setMainCategories(cached)
        }
      }
    }
    fetchMainCategories()
  }, [refetchTick])

  // Fetch Transport Vehicles
  useEffect(() => {
    const fetchTransportVehicles = async () => {
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<TransportVehicle[]>
        if (data.success && data.data) {
          setTransportVehicles(data.data)
          await cacheTransportVehicles(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch transport vehicles:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedTransportVehicles()
          if (cached.length > 0) setTransportVehicles(cached)
        }
      }
    }
    fetchTransportVehicles()
  }, [refetchTick])

  // Tags und Tag-Kategorien (Reihenfolge für Dialoge)
  useEffect(() => {
    const fetchTagsAndKategorien = async () => {
      try {
        const [tagsRes, katRes] = await Promise.all([fetch('/api/tags'), fetch('/api/tag-kategorien')])
        const tagsJson = (await tagsRes.json()) as ApiResponse<Tag[]>
        const katJson = (await katRes.json()) as ApiResponse<TagKategorie[]>
        if (tagsJson.success && tagsJson.data) {
          setTags(tagsJson.data)
          await cacheTags(tagsJson.data)
        }
        if (katJson.success && katJson.data) {
          setTagKategorien(katJson.data)
          await cacheTagKategorien(katJson.data)
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const [cachedTags, cachedKat] = await Promise.all([
            getCachedTags(),
            getCachedTagKategorien(),
          ])
          if (cachedTags.length > 0) setTags(cachedTags)
          if (cachedKat.length > 0) setTagKategorien(cachedKat)
        }
      }
    }
    fetchTagsAndKategorien()
  }, [refetchTick])

  const tagGroupsForEquipment = useMemo(
    () => buildTagGroupsForEquipment(tagKategorien, tags),
    [tagKategorien, tags]
  )

  // Fetch Mitreisende
  useEffect(() => {
    const fetchMitreisende = async () => {
      try {
        const res = await fetch('/api/mitreisende')
        const data = (await res.json()) as ApiResponse<Mitreisender[]>
        if (data.success && data.data) {
          setMitreisende(data.data.map(mitreisendenZeileAusApi))
          await cacheMitreisende(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch mitreisende:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedMitreisende()
          if (cached.length > 0) setMitreisende(cached.map(mitreisendenZeileAusApi))
        }
      }
    }
    fetchMitreisende()
  }, [refetchTick])

  // Bearbeitung: Bei nicht-⭐-Mitreisenden in der Auswahl Bereich automatisch aufklappen
  useEffect(() => {
    if (!showEditDialog || !editingItem) return
    const picks = editingItem.standard_mitreisende ?? []
    const brauchtWeitere = picks.some((id) =>
      mitreisende.some((m) => m.id === id && !m.urlaub_standard_mitnehmen)
    )
    if (brauchtWeitere) setIndividuelleMitreisendeExtraOffen(true)
  }, [showEditDialog, editingItem, mitreisende])

  const resetForm = () => {
    setFormData(createDefaultEquipmentFormValues())
  }

  const handleAddEquipment = () => {
    resetForm()
    const { categoryId, mainTitle } = equipmentVisibleSectionRef.current
    let target: CategorySelectScrollTarget | null = null
    if (categoryId) target = { kind: 'categoryRow', categoryId }
    else if (mainTitle) target = { kind: 'mainHeading', mainTitle }
    setAddEquipmentCategoryScrollTarget(target)
    setIndividuelleMitreisendeExtraOffen(false)
    setShowAddDialog(true)
  }

  const handleEditEquipment = (item: EquipmentItem) => {
    setEditingItem(item)
    setFormData(equipmentFormValuesFromItem(item))
    setShowEditDialog(true)
  }

  const handleSaveEquipment = async () => {
    if (!formData.was || !formData.kategorie_id) {
      alert('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }

    setIsSaving(true)
    try {
      const payload = buildEquipmentApiPayload(formData)

      const res = await fetch('/api/equipment-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<EquipmentItem>
      
      if (data.success) {
        setShowAddDialog(false)
        resetForm()
        const itemsRes = await fetch(`/api/equipment-items?_=${Date.now()}`, {
          cache: 'no-store',
        })
        const itemsData = (await itemsRes.json()) as ApiResponse<EquipmentItem[]>
        if (itemsData.success && itemsData.data) {
          await syncEquipmentSnapshot(itemsData.data)
        }
      } else {
        alert('Fehler beim Speichern: ' + (data.error ?? 'Unbekannt'))
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
        ...buildEquipmentApiPayload(formData),
      }

      const res = await fetch('/api/equipment-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as ApiResponse<EquipmentItem>
      
      if (data.success) {
        setShowEditDialog(false)
        setEditingItem(null)
        resetForm()
        const itemsRes = await fetch(`/api/equipment-items?_=${Date.now()}`, {
          cache: 'no-store',
        })
        const itemsData = (await itemsRes.json()) as ApiResponse<EquipmentItem[]>
        if (itemsData.success && itemsData.data) {
          await syncEquipmentSnapshot(itemsData.data)
        }
      } else {
        alert('Fehler beim Aktualisieren: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update equipment:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEquipment = (equipmentId: string) => {
    setDeleteEquipmentId(equipmentId)
  }

  const executeDeleteEquipment = async () => {
    if (!deleteEquipmentId) return
    const equipmentId = deleteEquipmentId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/equipment-items?id=${equipmentId}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<boolean>
      if (data.success) {
        await syncEquipmentSnapshot(equipmentItems.filter((item) => item.id !== equipmentId))
      } else {
        alert('Fehler beim Löschen des Gegenstands: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete equipment:', error)
      alert('Fehler beim Löschen des Gegenstands')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area - Flex-Layout: dynamische Höhe bis zum unteren Rand.
          h-dvh auf allen Bildschirmgrößen, damit der interne Tabellen-Scroll-Container greift
          und Sticky-Header funktionieren (statt Page-Scroll). */}
      <div className={cn(
        "flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300",
        "lg:ml-[280px]",
        "h-dvh min-h-dvh"
      )}>
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6 max-w-full">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-[30] flex-shrink-0 flex items-center justify-between bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
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
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Ausrüstung
                </h1>
              </div>
            </div>
          </div>

          {/* Equipment Table - füllt verfügbaren Platz, horizontales Scrollen in der Tabelle */}
          <div className="flex-1 min-h-0 min-w-0 mt-4 md:mt-6 overflow-hidden">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-[rgb(45,79,30)] border-t-transparent"></div>
                  <p className="text-muted-foreground animate-pulse">Ausrüstung wird geladen...</p>
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
                  onVisibleSectionChange={handleEquipmentVisibleSection}
                  readOnly={!canEditEquipment}
                  dynamicHeight
                />
              )}
          </div>

          {/* FAB: Neuer Gegenstand – nur für Admin */}
          {canEditEquipment && (
          <div className="fixed bottom-6 right-6 z-30">
            <Button
              size="icon"
              onClick={handleAddEquipment}
              className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </Button>
          </div>
          )}
        </div>
      </div>

      {/* Add Equipment Dialog – Padding wie Packliste (px-6) */}
      <ResponsiveModal
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) {
            setAddEquipmentCategoryScrollTarget(null)
            setIndividuelleMitreisendeExtraOffen(false)
          }
        }}
        title="Neuen Gegenstand hinzufügen"
        description="Fügen Sie einen neuen Ausrüstungsgegenstand hinzu"
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          <EquipmentItemFormFields
            value={formData}
            onChange={setFormData}
            idPrefix="add-eq"
            categories={categories}
            mainCategories={mainCategories}
            transportVehicles={transportVehicles}
            tagGroups={tagGroupsForEquipment}
            mitreisende={mitreisende}
            categorySelectScrollTarget={addEquipmentCategoryScrollTarget}
            individuelleMitreisendeExtraOpen={individuelleMitreisendeExtraOffen}
            onIndividuelleMitreisendeExtraOpenChange={setIndividuelleMitreisendeExtraOffen}
          />

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSaveEquipment} disabled={isSaving} className="flex-1">
              {isSaving ? 'Speichert...' : 'Speichern'}
            </Button>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving}>
              Abbrechen
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      {/* Gegenstand löschen – Bestätigung */}
      <ConfirmDialog
        open={!!deleteEquipmentId}
        onOpenChange={(open) => !open && setDeleteEquipmentId(null)}
        title="Gegenstand löschen"
        description={
          deleteEquipmentTarget
            ? `Möchten Sie „${deleteEquipmentTarget.was}" wirklich löschen? Der Gegenstand wird auch aus allen Packlisten entfernt.`
            : 'Möchten Sie diesen Gegenstand wirklich löschen?'
        }
        onConfirm={executeDeleteEquipment}
        isLoading={isLoading}
      />

      {/* Edit Equipment Dialog – Padding wie Packliste */}
      <ResponsiveModal
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) setIndividuelleMitreisendeExtraOffen(false)
        }}
        title="Gegenstand bearbeiten"
        description="Bearbeiten Sie die Details des Ausrüstungsgegenstands"
        contentClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
        noPadding
      >
        <div className="space-y-4 px-6 pt-4 pb-6">
          <EquipmentItemFormFields
            value={formData}
            onChange={setFormData}
            idPrefix="edit-eq"
            categories={categories}
            mainCategories={mainCategories}
            transportVehicles={transportVehicles}
            tagGroups={tagGroupsForEquipment}
            mitreisende={mitreisende}
            individuelleMitreisendeExtraOpen={individuelleMitreisendeExtraOffen}
            onIndividuelleMitreisendeExtraOpenChange={setIndividuelleMitreisendeExtraOffen}
            categorySelectMode="grouped"
          />

          <div className="flex gap-2 pt-4">
            <Button onClick={handleUpdateEquipment} disabled={isSaving} className="flex-1">
              {isSaving ? 'Speichert...' : 'Aktualisieren'}
            </Button>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isSaving}>
              Abbrechen
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </div>
  )
}
