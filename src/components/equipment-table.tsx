'use client'

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, Star, MoreVertical, Pencil, Trash2, ExternalLink, Sigma } from 'lucide-react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag } from '@/lib/db'
import { regelKurzLabel } from '@/lib/packing-quantity'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Checkbox } from '@/components/ui/checkbox'

interface EquipmentTableProps {
  equipmentItems: EquipmentItem[]
  categories: Category[]
  mainCategories: MainCategory[]
  transportVehicles: TransportVehicle[]
  tags: Tag[]
  onEdit: (item: EquipmentItem) => void
  onDelete: (id: string) => void
  /** Nur lesen – keine Bearbeitung/Löschung (z.B. für Kinder/Gäste) */
  readOnly?: boolean
  /** Dynamische Höhe bis zum unteren Bildschirmrand */
  dynamicHeight?: boolean
}

export const EquipmentTable = React.memo(({
  equipmentItems,
  categories,
  mainCategories,
  transportVehicles,
  tags,
  onEdit,
  onDelete,
  readOnly = false,
  dynamicHeight = false,
}: EquipmentTableProps) => {
  const isMobile = useIsMobile()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMainCategory, setFilterMainCategory] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTransport, setFilterTransport] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string[]>(['Normal', 'Immer gepackt'])
  const [filterTag, setFilterTag] = useState<string>('all')
  const [filterStandard, setFilterStandard] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [openLinksMenuId, setOpenLinksMenuId] = useState<string | null>(null)

  // Get category name by ID
  const getCategoryName = useCallback((categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    return category?.titel || 'Unbekannt'
  }, [categories])

  // Get main category ID by category ID
  const getMainCategoryId = useCallback((categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    return category?.hauptkategorie_id || null
  }, [categories])

  // Get transport name by ID
  const getTransportName = (transportId: string | null) => {
    if (!transportId) return '-'
    const transport = transportVehicles.find(t => t.id === transportId)
    return transport?.name || '-'
  }

  // Get tag names by IDs
  const getTagNames = (item: EquipmentItem) => {
    if (!item.tags || item.tags.length === 0) return []
    return item.tags.map(tag => {
      // Check if tag is an object with id or just a string ID
      const tagId = typeof tag === 'object' ? tag.id : tag
      const foundTag = tags.find(t => t.id === tagId)
      return foundTag?.titel || ''
    }).filter(Boolean)
  }

  // Format weight in kg with German decimal format (2 Nachkommastellen)
  const formatWeight = (weightInKg: number | null) => {
    if (weightInKg === null || weightInKg === undefined) return '-'
    return `${weightInKg.toFixed(2).replace('.', ',')} kg`
  }

  // Filter and search logic
  const filteredItems = useMemo(() => {
    return equipmentItems.filter(item => {
      // Search filter (title, details, links)
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matchesTitle = item.was.toLowerCase().includes(search)
        const matchesDetails = item.details?.toLowerCase().includes(search) || false
        const matchesLinks = item.links?.some(link => 
          link.url.toLowerCase().includes(search)
        ) || false
        
        if (!matchesTitle && !matchesDetails && !matchesLinks) {
          return false
        }
      }

      // Main category filter
      if (filterMainCategory !== 'all') {
        const itemMainCategoryId = getMainCategoryId(item.kategorie_id)
        if (itemMainCategoryId !== filterMainCategory) {
          return false
        }
      }

      // Category filter
      if (filterCategory !== 'all' && item.kategorie_id !== filterCategory) {
        return false
      }

      // Transport filter
      if (filterTransport !== 'all') {
        if (filterTransport === 'none' && item.transport_id !== null) {
          return false
        }
        if (filterTransport !== 'none' && item.transport_id !== filterTransport) {
          return false
        }
      }

      // Status filter (Multiple Choice)
      if (filterStatus.length > 0 && !filterStatus.includes(item.status)) {
        return false
      }

      // Tag filter
      if (filterTag !== 'all') {
        const itemTagIds = item.tags?.map(t => typeof t === 'object' ? t.id : t) || []
        if (!itemTagIds.includes(filterTag)) {
          return false
        }
      }

      // Standard filter
      if (filterStandard !== 'all') {
        const isStandard = item.is_standard ? 'true' : 'false'
        if (isStandard !== filterStandard) {
          return false
        }
      }

      return true
    })
  }, [equipmentItems, searchTerm, filterMainCategory, filterCategory, filterTransport, filterStatus, filterTag, filterStandard, getMainCategoryId])

  // Group by main category and then by category, sortiert nach reihenfolge (nicht alphabetisch)
  const groupedItems = useMemo(() => {
    if (filteredItems.length === 0) return []
    const mainCategoryGroups: Record<string, Record<string, EquipmentItem[]>> = {}
    
    filteredItems.forEach(item => {
      const mainCategoryId = getMainCategoryId(item.kategorie_id)
      const categoryId = item.kategorie_id
      const mainId = mainCategoryId ?? 'unknown'
      
      if (!mainCategoryGroups[mainId]) {
        mainCategoryGroups[mainId] = {}
      }
      if (!mainCategoryGroups[mainId][categoryId]) {
        mainCategoryGroups[mainId][categoryId] = []
      }
      mainCategoryGroups[mainId][categoryId].push(item)
    })

    const mainCategoryIds = Object.keys(mainCategoryGroups)
    mainCategoryIds.sort((a, b) => {
      const orderA = mainCategories.find(mc => mc.id === a)?.reihenfolge ?? 999
      const orderB = mainCategories.find(mc => mc.id === b)?.reihenfolge ?? 999
      return orderA - orderB
    })

    return mainCategoryIds.map(mainCategoryId => {
      const categoryGroup = mainCategoryGroups[mainCategoryId]
      if (!categoryGroup) return { mainCategoryId, mainCategoryName: 'Unbekannt', categories: [] }
      
      const mainCategory = mainCategories.find(mc => mc.id === mainCategoryId)
      const mainCategoryName = mainCategory?.titel ?? 'Unbekannt'
      
      const categoryIds = Object.keys(categoryGroup)
      categoryIds.sort((a, b) => {
        const orderA = categories.find(c => c.id === a)?.reihenfolge ?? 999
        const orderB = categories.find(c => c.id === b)?.reihenfolge ?? 999
        return orderA - orderB
      })

      return {
        mainCategoryId,
        mainCategoryName,
        categories: categoryIds.map(categoryId => ({
          categoryId,
          categoryName: getCategoryName(categoryId),
          items: categoryGroup[categoryId] || []
        }))
      }
    })
  }, [filteredItems, getCategoryName, getMainCategoryId, mainCategories, categories])

  // Flache Zeilenliste für Virtualisierung (Hauptkategorie → Kategorie → Items)
  // Eindeutige Keys mit mainCategoryId/categoryId verhindern Geisterzeilen durch Key-Kollisionen
  // Leere Kategorien werden übersprungen (verhindert "Unbekannt (0)"-Zeilen bei Filtern)
  const flatRows = useMemo(() => {
    const rows: Array<
      | { type: 'main-category'; id: string; name: string }
      | { type: 'category'; id: string; name: string; count: number }
      | { type: 'item'; id: string; item: EquipmentItem }
    > = []
    for (const mainGroup of groupedItems) {
      const mainId = mainGroup.mainCategoryId ?? `main-${mainGroup.mainCategoryName}`
      const categoriesWithItems = mainGroup.categories.filter(g => (g.items?.length ?? 0) > 0)
      if (categoriesWithItems.length === 0) continue // Hauptkategorie ohne Einträge überspringen
      rows.push({ type: 'main-category', id: `main-${mainId}`, name: mainGroup.mainCategoryName })
      for (const group of categoriesWithItems) {
        rows.push({
          type: 'category',
          id: `group-${mainId}-${group.categoryId}`,
          name: group.categoryName,
          count: group.items?.length ?? 0
        })
        for (const item of group.items ?? []) {
          rows.push({ type: 'item', id: item.id, item })
        }
      }
    }
    return rows
  }, [groupedItems])

  // Konstante Zeilenhöhen – müssen mit estimateSize unten übereinstimmen
  const MAIN_CAT_HEIGHT = 36
  const CATEGORY_HEIGHT = 36
  const ITEM_HEIGHT = 52

  const parentRef = useRef<HTMLDivElement>(null)
  const columnHeaderRef = useRef<HTMLDivElement>(null)
  const [columnHeaderHeight, setColumnHeaderHeight] = useState(44)

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    getItemKey: useCallback((index: number) => flatRows[index]?.id ?? index, [flatRows]),
    estimateSize: (index) => {
      const row = flatRows[index]
      if (!row) return ITEM_HEIGHT
      if (row.type === 'main-category') return MAIN_CAT_HEIGHT
      if (row.type === 'category') return CATEGORY_HEIGHT
      return ITEM_HEIGHT
    },
    overscan: 5,
  })

  // Spaltenkopfhöhe messen für korrekte top-Offsets der Sticky-Bänder.
  // ResizeObserver fängt Layout-Änderungen ab (z. B. Schriftgrößen-Änderungen).
  useEffect(() => {
    const el = columnHeaderRef.current
    if (!el) return
    const measure = () => {
      const h = el.getBoundingClientRect().height
      if (h > 0) setColumnHeaderHeight(h)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Bei Filteränderung: Nach oben scrollen (verhindert leere/verschobene Zeilen)
  const filterKey = `${filterMainCategory}-${filterCategory}-${filterTransport}-${filterStatus.join(',')}-${filterTag}-${filterStandard}-${searchTerm}`
  useEffect(() => {
    const el = parentRef.current
    if (el) el.scrollTop = 0
    virtualizer.measure()
  }, [filterKey, virtualizer])

  // Vorberechnete Zeilen-Startpositionen (deterministisch, da estimateSize fix ist)
  const rowStarts = useMemo(() => {
    const starts: number[] = []
    let cur = 0
    for (const r of flatRows) {
      starts.push(cur)
      cur += r.type === 'main-category' || r.type === 'category' ? MAIN_CAT_HEIGHT : ITEM_HEIGHT
    }
    return starts
  }, [flatRows])

  // Aktive Hauptkategorie/Kategorie + Push-Offsets aus dem aktuellen Scroll.
  //
  // Geometrie: Die Sticky-Bänder werden als `position: sticky` direkt nach dem
  // Spaltenkopf gerendert (ohne Flow-Platz dank `margin-bottom: -height`). Sie
  // pinnen visuell bei `top: columnHeaderHeight` (Hauptkat) bzw.
  // `top: columnHeaderHeight + MAIN_CAT_HEIGHT` (Kategorie).
  //
  // Aktivierungs-Schwellwerte (gleicher Container-Y wie virtualisierte Zeilen):
  //   - Hauptkat aktiv, sobald rowStarts[i] <= scrollOffset
  //   - Kategorie aktiv, sobald rowStarts[i] <= scrollOffset + MAIN_CAT_HEIGHT
  //
  // Push-Effekt: Nähert sich die nächste Haupt-/Kategorie-Zeile dem aktuellen
  // Banner, schieben wir das Banner per `transform: translateY(pushY)` nach oben
  // hinter den Spaltenkopf. Im steady state ist `pushY === 0`, sodass keine
  // React-getriebene Position-Änderung pro Scroll-Frame nötig ist – das Browser-
  // sticky übernimmt → kein Zittern.
  const stickyState = useMemo<{
    main: { name: string; pushY: number } | null
    category: { name: string; count: number; pushY: number } | null
  }>(() => {
    if (flatRows.length === 0) return { main: null, category: null }

    const scrollOffset = virtualizer.scrollOffset ?? 0
    const mainBannerY = scrollOffset
    const categoryBannerY = scrollOffset + MAIN_CAT_HEIGHT

    let activeMainIdx = -1
    let nextMainIdx = -1
    for (let i = 0; i < flatRows.length; i++) {
      const row = flatRows[i]
      const start = rowStarts[i]
      if (!row || start === undefined) continue
      if (row.type !== 'main-category') continue
      if (start <= mainBannerY) {
        activeMainIdx = i
      } else {
        nextMainIdx = i
        break
      }
    }

    if (activeMainIdx === -1) return { main: null, category: null }

    const activeMainRow = flatRows[activeMainIdx]
    if (!activeMainRow || activeMainRow.type !== 'main-category') {
      return { main: null, category: null }
    }

    let mainPushY = 0
    if (nextMainIdx !== -1) {
      const nextStart = rowStarts[nextMainIdx]
      if (nextStart !== undefined) {
        const distance = nextStart - mainBannerY
        if (distance < MAIN_CAT_HEIGHT) {
          mainPushY = distance - MAIN_CAT_HEIGHT // negativ -> nach oben aus Sicht
        }
      }
    }

    // Kategorie-Sticky: nur Kategorien innerhalb der aktiven Hauptkategorie
    const categoryEndBoundary = nextMainIdx === -1 ? flatRows.length : nextMainIdx
    let activeCategoryIdx = -1
    let nextCategoryIdx = -1
    for (let i = activeMainIdx + 1; i < categoryEndBoundary; i++) {
      const row = flatRows[i]
      const start = rowStarts[i]
      if (!row || start === undefined) continue
      if (row.type !== 'category') continue
      if (start <= categoryBannerY) {
        activeCategoryIdx = i
      } else {
        nextCategoryIdx = i
        break
      }
    }

    let categoryData: { name: string; count: number; pushY: number } | null = null
    if (activeCategoryIdx !== -1) {
      const activeCategoryRow = flatRows[activeCategoryIdx]
      if (activeCategoryRow && activeCategoryRow.type === 'category') {
        // Push-Boundary: nächste Kategorie im selben Main, sonst nächste Main
        // (next Main-Row passiert ebenfalls die Kategorie-Sticky-Position).
        let pushBoundary: number | null = null
        if (nextCategoryIdx !== -1) {
          pushBoundary = rowStarts[nextCategoryIdx] ?? null
        } else if (nextMainIdx !== -1) {
          pushBoundary = rowStarts[nextMainIdx] ?? null
        }

        let categoryPushY = 0
        if (pushBoundary !== null) {
          const distance = pushBoundary - categoryBannerY
          if (distance < CATEGORY_HEIGHT) {
            categoryPushY = distance - CATEGORY_HEIGHT
          }
        }
        categoryData = {
          name: activeCategoryRow.name,
          count: activeCategoryRow.count,
          pushY: categoryPushY,
        }
      }
    }

    return {
      main: { name: activeMainRow.name, pushY: mainPushY },
      category: categoryData,
    }
  }, [flatRows, rowStarts, virtualizer.scrollOffset])

  // Feste Spaltenbreiten: was, transport, gewicht, anzahl, status, abreise, gepacktFuer, details, tags, links, actions
  // Auf dem Smartphone etwas breitere Tags-Spalte und genügend Platz für Links
  const gridCols = isMobile
    ? '220px 110px 90px 48px 135px 48px 130px 260px 220px 56px 48px'
    : '220px 120px 90px 48px 135px 48px 130px 260px 220px 48px 44px'

  // Spalten-Ausrichtung für saubere vertikale Linien (Header und Body identisch)
  const colAlign = {
    was: 'text-left',
    transport: 'text-left',
    gewicht: 'text-right justify-end', // Zahlen rechts
    anzahl: 'text-center',
    status: 'text-left',
    abreise: 'text-center',
    gepacktFuer: 'text-left',
    details: 'text-left',
    tags: 'text-left',
    links: 'text-left',
    actions: 'text-left',
  }

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Normal': return 'bg-gray-100 text-gray-800'
      case 'Immer gepackt': return 'bg-green-100 text-green-800'
      case 'Fest Installiert': return 'bg-purple-100 text-purple-800'
      case 'Ausgemustert': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Standard-Statusfilter: Normal & Immer gepackt aktiv
  const defaultStatusFilter = ['Normal', 'Immer gepackt']
  const isDefaultStatusFilter =
    filterStatus.length === defaultStatusFilter.length &&
    defaultStatusFilter.every((s) => filterStatus.includes(s))
  return (
    <div className={cn(
      "space-y-4",
      dynamicHeight && "flex flex-col h-full min-h-0 min-w-0"
    )}>
      {/* Search and Filters - overflow-x-auto auf Mobile falls Filter zu breit */}
      <div className={cn(
        "space-y-4 bg-white border rounded-lg p-4 min-w-0 overflow-x-auto shadow-sm",
        dynamicHeight && "flex-shrink-0"
      )}>
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Titel, Beschreibung oder Links..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Hauptkategorie</Label>
              <Select value={filterMainCategory} onValueChange={setFilterMainCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {mainCategories.map(mc => (
                    <SelectItem key={mc.id} value={mc.id}>
                      {mc.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Transport</Label>
              <Select value={filterTransport} onValueChange={setFilterTransport}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="none">Kein Transport</SelectItem>
                  {transportVehicles.map(tv => (
                    <SelectItem key={tv.id} value={tv.id}>
                      {tv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kategorie</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {categories
                    .filter(c => filterMainCategory === 'all' || c.hauptkategorie_id === filterMainCategory)
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.titel}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tags</Label>
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {tags.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.titel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                <Star
                  className="h-4 w-4"
                  style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }}
                />
                <span>Standard</span>
              </Label>
              <Select value={filterStandard} onValueChange={setFilterStandard}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="true">Nur Standard</SelectItem>
                  <SelectItem value="false">Kein Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3">
              <Label>Status (Mehrfachauswahl)</Label>
              <div className="flex flex-wrap gap-3 mt-2">
                {['Normal', 'Immer gepackt', 'Fest Installiert', 'Ausgemustert'].map(status => (
                  <label key={status} className="flex items-center gap-2 cursor-pointer text-sm bg-background border rounded-md px-3 py-1.5 hover:bg-muted/50">
                    <Checkbox
                      checked={filterStatus.includes(status)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilterStatus([...filterStatus, status])
                        } else {
                          setFilterStatus(filterStatus.filter(s => s !== status))
                        }
                      }}
                      className="h-4 w-4"
                    />
                    {status}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-muted-foreground flex items-center justify-between">
          <div>
            {filteredItems.length} von {equipmentItems.length} Einträgen
            {(searchTerm ||
              filterMainCategory !== 'all' ||
              filterCategory !== 'all' ||
              filterTransport !== 'all' ||
              !isDefaultStatusFilter ||
              filterTag !== 'all' ||
              filterStandard !== 'all') && (
              <Button
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0"
                onClick={() => {
                  setSearchTerm('')
                  setFilterMainCategory('all')
                  setFilterCategory('all')
                  setFilterTransport('all')
                  setFilterStatus(['Normal', 'Immer gepackt'])
                  setFilterTag('all')
                  setFilterStandard('all')
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabelle - virtualisiert, weißer Hintergrund. overflow-x-auto für horizontales Scrollen auf Mobile */}
      <div className={cn(
        "border rounded-lg min-w-0 bg-white overflow-x-auto overflow-y-hidden",
        dynamicHeight && "flex-1 min-h-0 flex flex-col"
      )}>
        <div className="flex-1 min-h-0 min-w-0 flex flex-col min-w-[1400px]">
          <div className="min-w-[1400px] flex flex-col flex-1 min-h-0">
            {/* Scrollbarer Bereich für Datenzeilen */}
            <div
              ref={parentRef}
              className={cn(
                'overflow-y-auto overflow-x-hidden',
                dynamicHeight ? 'flex-1 min-h-0' : 'h-[600px]',
                !dynamicHeight && 'min-h-[200px]'
              )}
            >
              {/* Tabellenkopf – bleibt beim vertikalen Scrollen sichtbar (im selben Scroll-Container) */}
              <div
                ref={columnHeaderRef}
                className="grid gap-px bg-border border-b bg-gray-50 sticky top-0 z-20"
                style={{ gridTemplateColumns: gridCols }}
              >
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.was}`}>Was</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.transport}`}>Transport</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.gewicht}`}>Gewicht</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.anzahl}`}>#</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.status}`}>Status</div>
                <div className={`px-2 py-3 font-medium text-sm ${colAlign.abreise}`} title="Erst am Abreisetag">Abr.</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.gepacktFuer}`}>Gepackt für</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.details}`}>Details</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.tags}`}>Tags</div>
                <div className={`px-4 py-3 font-medium text-sm ${colAlign.links}`}>Links</div>
                <div className={`px-1 py-3 font-medium text-sm sticky right-0 z-25 bg-gray-50 ${colAlign.actions}`}></div>
              </div>
              {flatRows.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  Keine Ausrüstungsgegenstände gefunden
                </div>
              ) : (
                <>
                  {/* Sticky-Bänder Hauptkategorie + Kategorie als native CSS-Sticky.
                      `margin-bottom: -<height>` neutralisiert den Flow-Platz, sodass die
                      virtualisierten Zeilen direkt nach dem Spaltenkopf beginnen (kein
                      doppeltes Rendering). Der Browser-Compositor übernimmt die Pin-Position
                      → kein Zittern beim Scrollen. Nur für den Push-Effekt (wenn die nächste
                      Hauptkat/Kategorie das aktuelle Banner verdrängt) wird per
                      `transform: translateY(pushY)` nach oben hinter den Spaltenkopf (z:20)
                      geschoben – im steady state ist `pushY === 0`. */}
                  {stickyState.main && (
                    <div
                      className="sticky z-[19] flex items-center bg-[rgb(45,79,30)] text-white font-bold text-base px-4 pointer-events-none"
                      style={{
                        top: columnHeaderHeight,
                        height: MAIN_CAT_HEIGHT,
                        marginBottom: -MAIN_CAT_HEIGHT,
                        transform:
                          stickyState.main.pushY !== 0
                            ? `translate3d(0, ${stickyState.main.pushY}px, 0)`
                            : undefined,
                        willChange: 'transform',
                      }}
                    >
                      {stickyState.main.name}
                    </div>
                  )}
                  {stickyState.category && (
                    <div
                      className="sticky z-[18] flex items-center bg-muted font-semibold px-4 pointer-events-none"
                      style={{
                        top: columnHeaderHeight + MAIN_CAT_HEIGHT,
                        height: CATEGORY_HEIGHT,
                        marginBottom: -CATEGORY_HEIGHT,
                        transform:
                          stickyState.category.pushY !== 0
                            ? `translate3d(0, ${stickyState.category.pushY}px, 0)`
                            : undefined,
                        willChange: 'transform',
                      }}
                    >
                      {stickyState.category.name} ({stickyState.category.count})
                    </div>
                  )}
                  <div
                    className="relative w-full"
                    style={{ height: `${virtualizer.getTotalSize()}px` }}
                  >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const row = flatRows[virtualRow.index]
                    if (!row) return null
                    const size = virtualRow.size
                    const translateY = virtualRow.start

                    if (row.type === 'main-category') {
                      return (
                        <div
                          key={row.id}
                          className="absolute left-0 right-0 flex items-center bg-[rgb(45,79,30)] text-white font-bold text-base px-4 isolate"
                          style={{ height: size, top: 0, transform: `translate3d(0,${translateY}px,0)` }}
                        >
                          {row.name}
                        </div>
                      )
                    }
                    if (row.type === 'category') {
                      return (
                        <div
                          key={row.id}
                          className="absolute left-0 right-0 flex items-center bg-muted/70 font-semibold px-4 isolate"
                          style={{ height: size, top: 0, transform: `translate3d(0,${translateY}px,0)` }}
                        >
                          {row.name} ({row.count})
                        </div>
                      )
                    }
                    const item = row.item
                    return (
                      <div
                        key={row.id}
                        className="absolute left-0 right-0 grid gap-px bg-white hover:bg-muted/30 border-b border-border/50 isolate"
                        style={{
                          height: size,
                          top: 0,
                          transform: `translate3d(0,${translateY}px,0)`,
                          gridTemplateColumns: gridCols
                        }}
                      >
                        <div className={`px-4 py-2 text-sm flex items-center gap-2 ${colAlign.was}`}>
                          {item.is_standard ? (
                            <Star
                              className="h-4 w-4 flex-shrink-0"
                              style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }}
                            />
                          ) : (
                            <span className="w-4" />
                          )}
                          <span>{item.was}</span>
                        </div>
                        <div className={`px-4 py-2 text-sm flex items-center ${colAlign.transport}`}>{getTransportName(item.transport_id)}</div>
                        <div className={`px-4 py-2 text-sm flex items-center gap-1.5 ${colAlign.gewicht}`}>
                          {item.in_pauschale_inbegriffen && (item.einzelgewicht == null || item.einzelgewicht === 0) ? (
                            <span className="inline-flex items-center rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-xs" title="In Pauschale inbegriffen">
                              Pausch.
                            </span>
                          ) : (
                            formatWeight(item.einzelgewicht)
                          )}
                        </div>
                        <div className={`px-4 py-2 text-sm flex items-center justify-center gap-1 ${colAlign.anzahl}`}>
                          {item.mengenregel ? (
                            <span
                              className="inline-flex items-center gap-1 text-muted-foreground"
                              title={`Dynamische Regel: ${regelKurzLabel(item.mengenregel)}`}
                            >
                              <Sigma className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <span>{item.standard_anzahl}</span>
                          )}
                        </div>
                        <div className={`px-4 py-2 flex items-center ${colAlign.status}`}>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
                        </div>
                        <div className={`px-2 py-2 flex items-center justify-center text-center ${colAlign.abreise}`} title={item.erst_abreisetag_gepackt ? 'Erst am Abreisetag packen' : ''}>
                          {item.erst_abreisetag_gepackt ? (
                            <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs">Abr.</span>
                          ) : (
                            <span className="w-6 block" />
                          )}
                        </div>
                        <div className={`px-4 py-2 text-sm flex items-center ${colAlign.gepacktFuer}`}>
                          {item.mitreisenden_typ === 'pauschal' ? (
                            <span title="Pauschal">📦 Pauschal</span>
                          ) : item.mitreisenden_typ === 'alle' ? (
                            <span title="Für alle">👥 Alle</span>
                          ) : (
                            <span title="Individuell">👤 Individuell</span>
                          )}
                        </div>
                        <div className={`px-4 py-2 text-sm text-muted-foreground max-w-[320px] truncate flex items-center ${colAlign.details}`} title={item.details || ''}>
                          {item.details || '-'}
                        </div>
                        <div className={`px-4 py-2 flex items-center ${colAlign.tags}`}>
                          <div className="flex flex-wrap gap-1.5 pb-2">
                            {getTagNames(item).map((tagName, idx) => (
                              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                {tagName}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className={`px-4 py-2 flex items-center ${colAlign.links}`}>
                          {item.links && item.links.length > 0 ? (
                            <DropdownMenu open={openLinksMenuId === item.id} onOpenChange={(o) => setOpenLinksMenuId(o ? item.id : null)}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <ExternalLink className="h-4 w-4" style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {item.links.map((link, idx) => (
                                  <DropdownMenuItem
                                    key={idx}
                                    onSelect={() => {
                                      setOpenLinksMenuId(null)
                                      window.open(link.url, '_blank')
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-2" style={{ color: 'rgb(230,126,34)', fill: 'rgb(230,126,34)' }} />
                                    {link.url.length > 40 ? link.url.substring(0, 40) + '...' : link.url}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                        <div className={`px-1 py-2 sticky right-0 z-25 flex items-center justify-center ${colAlign.actions}`}>
                          {!readOnly && (
                          <DropdownMenu open={openMenuId === item.id} onOpenChange={(o) => setOpenMenuId(o ? item.id : null)}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 min-w-7 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setOpenMenuId(null)
                                  onEdit(item)
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setOpenMenuId(null)
                                  onDelete(item.id)
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Löschen
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

EquipmentTable.displayName = 'EquipmentTable'
