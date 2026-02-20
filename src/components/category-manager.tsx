import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Category, MainCategory, TransportVehicle } from '@/lib/db'
import { Checkbox } from '@/components/ui/checkbox'
import type { ApiResponse } from '@/lib/api-types'

interface CategoryWithMain extends Category {
  hauptkategorie_titel: string
}

type MainCategoryWithSubs = MainCategory & { categories: CategoryWithMain[] }

function SortableSubcategoryRow({
  cat,
  onEdit,
  onDelete,
}: {
  cat: CategoryWithMain
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center min-w-[44px] min-h-[44px] -my-1 text-muted-foreground/70 cursor-grab active:cursor-grabbing shrink-0"
        style={{ touchAction: 'none' }}
        aria-label="Zum Sortieren ziehen"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <p className="text-sm font-medium">{cat.titel}</p>
        {cat.pauschalgewicht != null && cat.pauschalgewicht > 0 && (
          <span className="text-xs text-muted-foreground">
            {cat.pauschal_pro_person ? `${cat.pauschalgewicht} kg/Person` : `${cat.pauschalgewicht} kg`}
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEdit() }}>
            <Pencil className="h-4 w-4 mr-2" />
            Bearbeiten
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDelete() }} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SortableMainCategoryRow({
  mainCat,
  isCompact,
  onEdit,
  onDelete,
  onAddSub,
  children,
}: {
  mainCat: MainCategoryWithSubs
  isCompact: boolean
  onEdit: () => void
  onDelete: () => void
  onAddSub: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: mainCat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-white overflow-hidden">
      <div className="flex items-center gap-2 p-3 py-1">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          style={{ touchAction: 'none' }}
          aria-label="Zum Sortieren ziehen"
        >
          <GripVertical className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="font-semibold text-[rgb(45,79,30)]">{mainCat.titel}</p>
          {mainCat.pauschalgewicht != null && mainCat.pauschalgewicht > 0 && (
            <span className="text-xs text-muted-foreground">
              {mainCat.pauschal_pro_person ? `${mainCat.pauschalgewicht} kg/Person` : `${mainCat.pauschalgewicht} kg`}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onEdit() }}>
              <Pencil className="h-4 w-4 mr-2" />
              Bearbeiten
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDelete() }} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!isCompact && (
        <div className="px-3 pb-2 space-y-1">
          {children}
          <button type="button" onClick={onAddSub} className="text-sm text-muted-foreground hover:text-foreground py-2 transition-colors">
            + Unterkategorie hinzufügen
          </button>
        </div>
      )}
    </div>
  )
}

interface CategoryManagerProps {
  categories: CategoryWithMain[]
  mainCategories: MainCategory[]
  transportVehicles: TransportVehicle[]
  onRefresh: () => void
  /** Wenn true, wird der Dialog für neue Hauptkategorie geöffnet (z.B. von FAB); nach Öffnen wird onOpenNewMainCategoryConsumed aufgerufen */
  openNewMainCategoryTrigger?: boolean
  onOpenNewMainCategoryConsumed?: () => void
}

export function CategoryManager({
  categories,
  mainCategories,
  transportVehicles,
  onRefresh,
  openNewMainCategoryTrigger,
  onOpenNewMainCategoryConsumed
}: CategoryManagerProps) {
  const [showMainCategoryDialog, setShowMainCategoryDialog] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [editingMainCategory, setEditingMainCategory] = useState<MainCategory | null>(null)
  const [editingCategory, setEditingCategory] = useState<CategoryWithMain | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [draggingMainId, setDraggingMainId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'main' | 'category'; id: string } | null>(null)

  // Touch vor Pointer: auf Mobilgeräten explizite Touch-Behandlung
  // touch-action: none am Handle verhindert, dass Scroll das Drag-Gesteure übernimmt
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const [mainCategoryForm, setMainCategoryForm] = useState({
    titel: '',
    pauschalgewicht: '' as string | number,
    pauschal_pro_person: false,
    pauschal_transport_id: '' as string
  })

  const [categoryForm, setCategoryForm] = useState({
    titel: '',
    hauptkategorieId: '',
    pauschalgewicht: '' as string | number,
    pauschal_pro_person: false,
    pauschal_transport_id: '' as string
  })

  // FAB-Trigger: Von außen (z.B. Klick auf FAB) Dialog für neue Hauptkategorie öffnen
  useEffect(() => {
    if (openNewMainCategoryTrigger) {
      setEditingMainCategory(null)
      setMainCategoryForm({ titel: '', pauschalgewicht: '', pauschal_pro_person: false, pauschal_transport_id: '' })
      setShowMainCategoryDialog(true)
      onOpenNewMainCategoryConsumed?.()
    }
  }, [openNewMainCategoryTrigger, onOpenNewMainCategoryConsumed])

  const handleCreateMainCategory = async () => {
    if (!mainCategoryForm.titel) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    const nextReihenfolge = mainCategories.length > 0
      ? Math.max(...mainCategories.map(m => m.reihenfolge)) + 1
      : 0

    setIsLoading(true)
    try {
      const pauschalgewichtNum =
        mainCategoryForm.pauschalgewicht !== '' && mainCategoryForm.pauschalgewicht != null
          ? Number(mainCategoryForm.pauschalgewicht)
          : null
      const res = await fetch('/api/main-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: mainCategoryForm.titel,
          reihenfolge: nextReihenfolge,
          pauschalgewicht: pauschalgewichtNum,
          pauschal_pro_person: pauschalgewichtNum != null ? mainCategoryForm.pauschal_pro_person : undefined,
          pauschal_transport_id:
            pauschalgewichtNum != null && mainCategoryForm.pauschal_transport_id
              ? mainCategoryForm.pauschal_transport_id
              : null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowMainCategoryDialog(false)
        setMainCategoryForm({ titel: '', pauschalgewicht: '', pauschal_pro_person: false, pauschal_transport_id: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create main category:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateMainCategory = async () => {
    if (!editingMainCategory || !mainCategoryForm.titel) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const pauschalgewichtNum =
        mainCategoryForm.pauschalgewicht !== '' && mainCategoryForm.pauschalgewicht != null
          ? Number(mainCategoryForm.pauschalgewicht)
          : null
      const res = await fetch('/api/main-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMainCategory.id,
          titel: mainCategoryForm.titel,
          reihenfolge: editingMainCategory.reihenfolge,
          pauschalgewicht: pauschalgewichtNum,
          pauschal_pro_person: pauschalgewichtNum != null ? mainCategoryForm.pauschal_pro_person : undefined,
          pauschal_transport_id:
            pauschalgewichtNum != null && mainCategoryForm.pauschal_transport_id
              ? mainCategoryForm.pauschal_transport_id
              : null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowMainCategoryDialog(false)
        setEditingMainCategory(null)
        setMainCategoryForm({ titel: '', pauschalgewicht: '', pauschal_pro_person: false, pauschal_transport_id: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update main category:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteMainCategory = (id: string) => {
    setDeleteConfirm({ type: 'main', id })
  }

  const executeDeleteMainCategory = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'main') return
    const id = deleteConfirm.id

    setIsLoading(true)
    try {
      const res = await fetch(`/api/main-categories?id=${id}`, {
        method: 'DELETE'
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete main category:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!categoryForm.titel || !categoryForm.hauptkategorieId) {
      alert('Bitte füllen Sie alle Pflichtfelder aus')
      return
    }

    const subCats = categories.filter(c => c.hauptkategorie_id === categoryForm.hauptkategorieId)
    const nextReihenfolge = subCats.length > 0
      ? Math.max(...subCats.map(c => c.reihenfolge)) + 1
      : 0

    setIsLoading(true)
    try {
      const pauschalgewichtNum =
        categoryForm.pauschalgewicht !== '' && categoryForm.pauschalgewicht != null
          ? Number(categoryForm.pauschalgewicht)
          : null
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titel: categoryForm.titel,
          hauptkategorieId: categoryForm.hauptkategorieId,
          reihenfolge: nextReihenfolge,
          pauschalgewicht: pauschalgewichtNum,
          pauschal_pro_person: pauschalgewichtNum != null ? categoryForm.pauschal_pro_person : undefined,
          pauschal_transport_id:
            pauschalgewichtNum != null && categoryForm.pauschal_transport_id ? categoryForm.pauschal_transport_id : null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowCategoryDialog(false)
        setCategoryForm({ titel: '', hauptkategorieId: '', pauschalgewicht: '', pauschal_pro_person: false, pauschal_transport_id: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      alert('Fehler beim Erstellen')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.titel) {
      alert('Bitte geben Sie einen Titel ein')
      return
    }

    setIsLoading(true)
    try {
      const pauschalgewichtNum =
        categoryForm.pauschalgewicht !== '' && categoryForm.pauschalgewicht != null
          ? Number(categoryForm.pauschalgewicht)
          : null
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory.id,
          titel: categoryForm.titel,
          hauptkategorieId: categoryForm.hauptkategorieId || undefined,
          reihenfolge: editingCategory.reihenfolge,
          pauschalgewicht: pauschalgewichtNum,
          pauschal_pro_person: pauschalgewichtNum != null ? categoryForm.pauschal_pro_person : undefined,
          pauschal_transport_id:
            pauschalgewichtNum != null && categoryForm.pauschal_transport_id ? categoryForm.pauschal_transport_id : null
        })
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        setShowCategoryDialog(false)
        setEditingCategory(null)
        setCategoryForm({ titel: '', hauptkategorieId: '', pauschalgewicht: '', pauschal_pro_person: false, pauschal_transport_id: '' })
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to update category:', error)
      alert('Fehler beim Aktualisieren')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCategory = (id: string) => {
    setDeleteConfirm({ type: 'category', id })
  }

  const executeDeleteCategory = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'category') return
    const id = deleteConfirm.id

    setIsLoading(true)
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: 'DELETE'
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (data.success) {
        onRefresh()
      } else {
        alert('Fehler: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Fehler beim Löschen')
    } finally {
      setIsLoading(false)
    }
  }

  const executeDeleteConfirm = async () => {
    if (deleteConfirm?.type === 'main') await executeDeleteMainCategory()
    else if (deleteConfirm?.type === 'category') await executeDeleteCategory()
  }

  const openEditMainCategory = (mainCategory: MainCategory) => {
    setEditingMainCategory(mainCategory)
    setMainCategoryForm({
      titel: mainCategory.titel,
      pauschalgewicht: mainCategory.pauschalgewicht ?? '',
      pauschal_pro_person: mainCategory.pauschal_pro_person ?? false,
      pauschal_transport_id: mainCategory.pauschal_transport_id ?? ''
    })
    setShowMainCategoryDialog(true)
  }

  const openEditCategory = (category: CategoryWithMain) => {
    setEditingCategory(category)
    setCategoryForm({
      titel: category.titel,
      hauptkategorieId: category.hauptkategorie_id,
      pauschalgewicht: category.pauschalgewicht ?? '',
      pauschal_pro_person: category.pauschal_pro_person ?? false,
      pauschal_transport_id: category.pauschal_transport_id ?? ''
    })
    setShowCategoryDialog(true)
  }

  const openNewCategory = (mainCategoryId: string) => {
    setEditingCategory(null)
    setCategoryForm({
      titel: '',
      hauptkategorieId: mainCategoryId,
      pauschalgewicht: '',
      pauschal_pro_person: false,
      pauschal_transport_id: ''
    })
    setShowCategoryDialog(true)
  }

  // Group categories by main category (sorted by reihenfolge)
  const categoriesByMain: MainCategoryWithSubs[] = mainCategories.map(main => ({
    ...main,
    categories: categories
      .filter(cat => cat.hauptkategorie_id === main.id)
      .sort((a, b) => a.reihenfolge - b.reihenfolge)
  }))

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const mainIds = new Set(mainCategories.map(m => m.id))
    if (mainIds.has(event.active.id as string)) {
      setDraggingMainId(event.active.id as string)
    }
  }, [mainCategories])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setDraggingMainId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const mainIds = new Set(mainCategories.map(m => m.id))

    if (mainIds.has(active.id as string)) {
      // Main category reorder
      const oldIndex = mainCategories.findIndex(m => m.id === active.id)
      const newIndex = mainCategories.findIndex(m => m.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove([...mainCategories], oldIndex, newIndex)
      setIsLoading(true)
      try {
        for (let i = 0; i < reordered.length; i++) {
          const mc = reordered[i]
          if (!mc) continue
          await fetch('/api/main-categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: mc.id, titel: mc.titel, reihenfolge: i })
          })
        }
        onRefresh()
      } catch (e) {
        console.error('Failed to reorder main categories:', e)
        onRefresh()
      } finally {
        setIsLoading(false)
      }
    } else {
      // Subcategory reorder - find which main category
      const mainCat = categoriesByMain.find(m => m.categories.some(c => c.id === active.id))
      if (!mainCat) return

      const subCats = mainCat.categories
      const oldIndex = subCats.findIndex(c => c.id === active.id)
      const newIndex = subCats.findIndex(c => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove([...subCats], oldIndex, newIndex)
      setIsLoading(true)
      try {
        for (let i = 0; i < reordered.length; i++) {
          const cat = reordered[i]
          if (!cat) continue
          await fetch('/api/categories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: cat.id, titel: cat.titel, hauptkategorieId: mainCat.id, reihenfolge: i })
          })
        }
        onRefresh()
      } catch (e) {
        console.error('Failed to reorder categories:', e)
        onRefresh()
      } finally {
        setIsLoading(false)
      }
    }
  }, [mainCategories, categoriesByMain, onRefresh])

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        {/* Main categories – beim Ziehen einer Hauptkategorie werden Unterkategorien ausgeblendet */}
        <SortableContext
          items={mainCategories.map(m => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {categoriesByMain.map((mainCat) => (
            <SortableMainCategoryRow
              key={mainCat.id}
              mainCat={mainCat}
              isCompact={!!draggingMainId}
              onEdit={() => openEditMainCategory(mainCat)}
              onDelete={() => handleDeleteMainCategory(mainCat.id)}
              onAddSub={() => openNewCategory(mainCat.id)}
            >
              {mainCat.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-2">Keine Unterkategorien</p>
              ) : (
                <SortableContext
                  items={mainCat.categories.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {mainCat.categories.map((cat) => (
                    <SortableSubcategoryRow
                      key={cat.id}
                      cat={cat}
                      onEdit={() => openEditCategory(cat)}
                      onDelete={() => handleDeleteCategory(cat.id)}
                    />
                  ))}
                </SortableContext>
              )}
            </SortableMainCategoryRow>
          ))}
        </SortableContext>

        {mainCategories.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Noch keine Kategorien. Legen Sie über den + Button eine Hauptkategorie an.</p>
        )}
      </div>
    </DndContext>

    {/* Main Category Dialog */}
      <ResponsiveModal
        open={showMainCategoryDialog}
        onOpenChange={setShowMainCategoryDialog}
        title={editingMainCategory ? 'Hauptkategorie bearbeiten' : 'Neue Hauptkategorie'}
        description={editingMainCategory ? 'Ändern Sie die Hauptkategorie-Details' : 'Erstellen Sie eine neue Hauptkategorie'}
      >
        <div className="space-y-4">
            <div>
              <Label htmlFor="main-cat-titel">Titel *</Label>
              <Input
                id="main-cat-titel"
                value={mainCategoryForm.titel}
                onChange={(e) => setMainCategoryForm({ ...mainCategoryForm, titel: e.target.value })}
                placeholder="z.B. Campingausrüstung"
              />
            </div>
            <div>
              <Label htmlFor="main-cat-pauschal">Pauschalgewicht (kg)</Label>
              <Input
                id="main-cat-pauschal"
                type="number"
                min={0}
                step={0.1}
                value={mainCategoryForm.pauschalgewicht}
                onChange={(e) =>
                  setMainCategoryForm({ ...mainCategoryForm, pauschalgewicht: e.target.value ? Number(e.target.value) : '' })
                }
                placeholder="z.B. 18"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pauschalgewicht für Gegenstände, die als „in Pauschale inbegriffen“ markiert sind
              </p>
            </div>
            {(mainCategoryForm.pauschalgewicht !== '' && mainCategoryForm.pauschalgewicht != null) && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="main-cat-pro-person"
                    checked={mainCategoryForm.pauschal_pro_person}
                    onCheckedChange={(c) =>
                      setMainCategoryForm({ ...mainCategoryForm, pauschal_pro_person: !!c })
                    }
                  />
                  <Label htmlFor="main-cat-pro-person" className="cursor-pointer">
                    Pro Person (z.B. 18 kg × Anzahl Mitreisende)
                  </Label>
                </div>
                <div>
                  <Label htmlFor="main-cat-transport">Pauschale zuordnen zu</Label>
                  <Select
                    value={mainCategoryForm.pauschal_transport_id || 'none'}
                    onValueChange={(v) =>
                      setMainCategoryForm({
                        ...mainCategoryForm,
                        pauschal_transport_id: v === 'none' ? '' : v
                      })
                    }
                  >
                    <SelectTrigger id="main-cat-transport">
                      <SelectValue placeholder="Transport wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Keiner —</SelectItem>
                      {transportVehicles.map((tv) => (
                        <SelectItem key={tv.id} value={tv.id}>
                          {tv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <Button
              onClick={editingMainCategory ? handleUpdateMainCategory : handleCreateMainCategory}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingMainCategory ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Category Dialog */}
      <ResponsiveModal
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        title={editingCategory ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
        description={editingCategory ? 'Ändern Sie die Kategorie-Details' : 'Erstellen Sie eine neue Kategorie'}
      >
        <div className="space-y-4">
            <div>
              <Label htmlFor="cat-titel">Titel *</Label>
              <Input
                id="cat-titel"
                value={categoryForm.titel}
                onChange={(e) => setCategoryForm({ ...categoryForm, titel: e.target.value })}
                placeholder="z.B. Grundausstattung"
              />
            </div>
            <div>
              <Label htmlFor="cat-main">Hauptkategorie *</Label>
              <Select
                value={categoryForm.hauptkategorieId}
                onValueChange={(value) => setCategoryForm({ ...categoryForm, hauptkategorieId: value })}
              >
                <SelectTrigger id="cat-main">
                  <SelectValue placeholder="Wählen Sie eine Hauptkategorie" />
                </SelectTrigger>
                <SelectContent>
                  {mainCategories.map((main) => (
                    <SelectItem key={main.id} value={main.id}>
                      {main.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cat-pauschal">Pauschalgewicht (kg)</Label>
              <Input
                id="cat-pauschal"
                type="number"
                min={0}
                step={0.1}
                value={categoryForm.pauschalgewicht}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, pauschalgewicht: e.target.value ? Number(e.target.value) : '' })
                }
                placeholder="Optional – hat Vorrang vor Hauptkategorie-Pauschale"
              />
            </div>
            {(categoryForm.pauschalgewicht !== '' && categoryForm.pauschalgewicht != null) && (
              <>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="cat-pro-person"
                    checked={categoryForm.pauschal_pro_person}
                    onCheckedChange={(c) =>
                      setCategoryForm({ ...categoryForm, pauschal_pro_person: !!c })
                    }
                  />
                  <Label htmlFor="cat-pro-person" className="cursor-pointer">
                    Pro Person
                  </Label>
                </div>
                <div>
                  <Label htmlFor="cat-transport">Pauschale zuordnen zu</Label>
                  <Select
                    value={categoryForm.pauschal_transport_id || 'none'}
                    onValueChange={(v) =>
                      setCategoryForm({
                        ...categoryForm,
                        pauschal_transport_id: v === 'none' ? '' : v
                      })
                    }
                  >
                    <SelectTrigger id="cat-transport">
                      <SelectValue placeholder="Transport wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Keiner —</SelectItem>
                      {transportVehicles.map((tv) => (
                        <SelectItem key={tv.id} value={tv.id}>
                          {tv.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <Button
              onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Wird gespeichert...' : editingCategory ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
      </ResponsiveModal>

      {/* Kategorie/Hauptkategorie löschen – Bestätigung */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={deleteConfirm?.type === 'main' ? 'Hauptkategorie löschen' : 'Kategorie löschen'}
        description={
          deleteConfirm?.type === 'main'
            ? 'Möchten Sie diese Hauptkategorie wirklich löschen?'
            : 'Möchten Sie diese Kategorie wirklich löschen?'
        }
        onConfirm={executeDeleteConfirm}
        isLoading={isLoading}
      />
    </>
  )
}
