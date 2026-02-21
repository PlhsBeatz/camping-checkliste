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
import { Search, Filter, Star, MoreVertical, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag } from '@/lib/db'
import { cn } from '@/lib/utils'

interface EquipmentTableProps {
  equipmentItems: EquipmentItem[]
  categories: Category[]
  mainCategories: MainCategory[]
  transportVehicles: TransportVehicle[]
  tags: Tag[]
  onEdit: (item: EquipmentItem) => void
  onDelete: (id: string) => void
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
  dynamicHeight = false,
}: EquipmentTableProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMainCategory, setFilterMainCategory] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterTransport, setFilterTransport] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string[]>(['Normal', 'Immer gepackt'])
  const [filterTag, setFilterTag] = useState<string>('all')
  const [filterStandard, setFilterStandard] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

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

  const parentRef = useRef<HTMLDivElement>(null)
  const headerHeight = 49
  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    getItemKey: useCallback((index: number) => flatRows[index]?.id ?? index, [flatRows]),
    estimateSize: (index) => {
      const row = flatRows[index]
      if (!row) return 52
      if (row.type === 'main-category') return 36
      if (row.type === 'category') return 36
      return 52
    },
    overscan: 5,
    paddingStart: headerHeight,
  })

  // Bei Filteränderung: Nach oben scrollen (verhindert leere/verschobene Zeilen)
  const filterKey = `${filterMainCategory}-${filterCategory}-${filterTransport}-${filterStatus.join(',')}-${filterTag}-${filterStandard}-${searchTerm}`
  useEffect(() => {
    const el = parentRef.current
    if (el) el.scrollTop = 0
    virtualizer.measure()
  }, [filterKey, virtualizer])

  // Feste Spaltenbreiten: was, transport, gewicht, anzahl, status, abreise, gepacktFuer, details, tags, links, actions
  const gridCols = '220px 120px 90px 48px 135px 48px 130px 220px 150px 48px 44px'

  // Spalten-Ausrichtung für saubere vertikale Linien (Header und Body identisch)
  const colAlign = {
    was: 'text-left',
    transport: 'text-left',
    gewicht: 'text-right', // Zahlen rechts
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
  return (
    <div className={cn(
      "space-y-4",
      dynamicHeight && "flex flex-col h-full min-h-0 min-w-0"
    )}>
      {/* Search and Filters */}
      <div className={cn(
        "space-y-4 border rounded-lg p-4 bg-muted/30",
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
              <Label>Standard (⭐)</Label>
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
                    <input
                      type="checkbox"
                      checked={filterStatus.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterStatus([...filterStatus, status])
                        } else {
                          setFilterStatus(filterStatus.filter(s => s !== status))
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
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
            {(searchTerm || filterMainCategory !== 'all' || filterCategory !== 'all' || filterTransport !== 'all' || filterStatus.length !== 3 || filterTag !== 'all' || filterStandard !== 'all') && (
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

      {/* Tabelle - virtualisiert für 500+ Zeilen (nur ~20 sichtbare DOM-Zeilen), weißer Hintergrund */}
      <div className={cn(
        "border rounded-lg overflow-hidden min-w-0 bg-white",
        dynamicHeight && "flex-1 min-h-0 flex flex-col"
      )}>
        {/* Horizontal scrollbar auf Mobile - min-w-0 erlaubt Schrumpfen, overflow-x-auto ermöglicht Scroll */}
        <div className="overflow-x-auto flex-1 min-h-0 min-w-0 flex flex-col">
          <div className="min-w-[1253px] flex flex-col flex-1 min-h-0">
            {/* Ein gemeinsamer vertikaler Scroll: Header + Body scrollen zusammen (paddingStart für Header) */}
            <div
              ref={parentRef}
              className={cn(
                'overflow-y-auto overflow-x-hidden',
                dynamicHeight ? 'flex-1 min-h-0' : 'h-[600px]',
                !dynamicHeight && 'min-h-[200px]'
              )}
            >
          {flatRows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Keine Ausrüstungsgegenstände gefunden
            </div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {/* Header im Padding-Bereich - scrollt mit */}
              <div
                className="absolute top-0 left-0 right-0 grid gap-px bg-border border-b bg-gray-50"
                style={{ gridTemplateColumns: gridCols, height: `${headerHeight}px` }}
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
                <div className={`px-1 py-3 font-medium text-sm ${colAlign.actions}`}></div>
              </div>
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
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      ) : (
                        <span className="w-4" />
                      )}
                      <span>{item.was}</span>
                    </div>
                    <div className={`px-4 py-2 text-sm ${colAlign.transport}`}>{getTransportName(item.transport_id)}</div>
                    <div className={`px-4 py-2 text-sm flex items-center gap-1.5 ${colAlign.gewicht}`}>
                      {item.in_pauschale_inbegriffen && (item.einzelgewicht == null || item.einzelgewicht === 0) ? (
                        <span className="inline-flex items-center rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-xs" title="In Pauschale inbegriffen">
                          Pausch.
                        </span>
                      ) : (
                        formatWeight(item.einzelgewicht)
                      )}
                    </div>
                    <div className={`px-4 py-2 text-sm ${colAlign.anzahl}`}>{item.standard_anzahl}</div>
                    <div className={`px-4 py-2 ${colAlign.status}`}>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className={`px-2 py-2 text-center ${colAlign.abreise}`} title={item.erst_abreisetag_gepackt ? 'Erst am Abreisetag packen' : ''}>
                      {item.erst_abreisetag_gepackt ? (
                        <span className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs">Abr.</span>
                      ) : (
                        <span className="w-6 block" />
                      )}
                    </div>
                    <div className={`px-4 py-2 text-sm ${colAlign.gepacktFuer}`}>
                      {item.mitreisenden_typ === 'pauschal' ? (
                        <span title="Pauschal">📦 Pauschal</span>
                      ) : item.mitreisenden_typ === 'alle' ? (
                        <span title="Für alle">👥 Alle</span>
                      ) : (
                        <span title="Individuell">👤 Individuell</span>
                      )}
                    </div>
                    <div className={`px-4 py-2 text-sm text-muted-foreground max-w-[300px] truncate ${colAlign.details}`} title={item.details || ''}>
                      {item.details || '-'}
                    </div>
                    <div className={`px-4 py-2 ${colAlign.tags}`}>
                      <div className="flex flex-wrap gap-1">
                        {getTagNames(item).map((tagName, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                            {tagName}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className={`px-4 py-2 flex items-center ${colAlign.links}`}>
                      {item.links && item.links.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <ExternalLink className="h-4 w-4 text-blue-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.links.map((link, idx) => (
                              <DropdownMenuItem
                                key={idx}
                                onSelect={(e) => {
                                  e.preventDefault()
                                  window.open(link.url, '_blank')
                                }}
                                className="cursor-pointer"
                              >
                                <ExternalLink className="h-3 w-3 mr-2" />
                                {link.url.length > 40 ? link.url.substring(0, 40) + '...' : link.url}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    <div className={`px-1 py-2 sticky right-0 bg-white flex items-center justify-center ${colAlign.actions}`}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 min-w-7 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              onEdit(item)
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault()
                              onDelete(item.id)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

EquipmentTable.displayName = 'EquipmentTable'
