'use client'

import React, { useState, useMemo, useCallback } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Filter, Star, MoreVertical, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { EquipmentItem, Category, MainCategory, TransportVehicle, Tag } from '@/lib/db'

interface EquipmentTableProps {
  equipmentItems: EquipmentItem[]
  categories: Category[]
  mainCategories: MainCategory[]
  transportVehicles: TransportVehicle[]
  tags: Tag[]
  onEdit: (item: EquipmentItem) => void
  onDelete: (id: string) => void
}

export const EquipmentTable = React.memo(({
  equipmentItems,
  categories,
  mainCategories,
  transportVehicles,
  tags,
  onEdit,
  onDelete,
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

  // Get main category name by category ID
  const getMainCategoryName = useCallback((categoryId: string) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return 'Unbekannt'
    const mainCategory = mainCategories.find(mc => mc.id === category.hauptkategorie_id)
    return mainCategory?.titel || 'Unbekannt'
  }, [categories, mainCategories])

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

  // Format weight in kg with German decimal format
  const formatWeight = (weightInKg: number | null) => {
    if (weightInKg === null || weightInKg === undefined) return '-'
    return `${weightInKg.toFixed(3).replace('.', ',')} kg`
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

  // Group by main category and then by category
  const groupedItems = useMemo(() => {
    if (filteredItems.length === 0) return []
    const mainCategoryGroups: Record<string, Record<string, EquipmentItem[]>> = {}
    
    filteredItems.forEach(item => {
      const mainCategoryName = getMainCategoryName(item.kategorie_id)
      const categoryName = getCategoryName(item.kategorie_id)
      
      if (!mainCategoryGroups[mainCategoryName]) {
        mainCategoryGroups[mainCategoryName] = {}
      }
      if (!mainCategoryGroups[mainCategoryName][categoryName]) {
        mainCategoryGroups[mainCategoryName][categoryName] = []
      }
      mainCategoryGroups[mainCategoryName][categoryName].push(item)
    })

    return Object.keys(mainCategoryGroups)
      .sort()
      .map(mainCategoryName => {
        const categoryGroup = mainCategoryGroups[mainCategoryName]
        if (!categoryGroup) return { mainCategoryName, categories: [] }
        
        return {
          mainCategoryName,
          categories: Object.keys(categoryGroup)
            .sort()
            .map(categoryName => ({
              categoryName,
              items: categoryGroup[categoryName] || []
            }))
        }
      })
  }, [filteredItems, getCategoryName, getMainCategoryName])

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
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
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

      {/* Table - horizontales Scrollen bei vielen Spalten */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table className="w-full">
            <TableHeader className="sticky top-0 bg-background z-30 border-b">
              <TableRow>
                <TableHead className="min-w-[200px]">Was</TableHead>
                <TableHead className="min-w-[100px]">Transport</TableHead>
                <TableHead className="min-w-[100px]">Gewicht</TableHead>
                <TableHead className="min-w-[60px]">#</TableHead>
                <TableHead className="min-w-[120px]">Status</TableHead>
                <TableHead className="min-w-[150px]">Gepackt für</TableHead>
                <TableHead className="min-w-[200px] max-w-[300px]">Details</TableHead>
                <TableHead className="min-w-[150px]">Tags</TableHead>
                <TableHead className="min-w-[60px]">Links</TableHead>
                <TableHead className="min-w-[80px] sticky right-0 bg-background"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Keine Ausrüstungsgegenstände gefunden
                  </TableCell>
                </TableRow>
              ) : (
                groupedItems.map((mainGroup) => (
                  <React.Fragment key={`main-${mainGroup.mainCategoryName}`}>
                    <TableRow className="bg-[rgb(45,79,30)] text-white">
                      <TableCell colSpan={10} className="font-bold text-base py-3">
                        {mainGroup.mainCategoryName}
                      </TableCell>
                    </TableRow>
                    {mainGroup.categories.map((group) => (
                      <React.Fragment key={`group-${group.categoryName}`}>
                        <TableRow className="bg-muted/70">
                          <TableCell colSpan={10} className="font-semibold py-2">
                            {group.categoryName} ({group.items?.length || 0})
                          </TableCell>
                        </TableRow>
                        {group.items?.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {item.is_standard ? (
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                                ) : (
                                  <span className="w-4" />
                                )}
                                <span>{item.was}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {getTransportName(item.transport_id)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatWeight(item.einzelgewicht)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.standard_anzahl}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                                {item.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {item.mitreisenden_typ === 'pauschal' ? (
                                <span title="Pauschal">📦 Pauschal</span>
                              ) : item.mitreisenden_typ === 'alle' ? (
                                <span title="Für alle">👥 Alle</span>
                              ) : (
                                <span title="Individuell">👤 Individuell</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                              <div className="truncate" title={item.details || ''}>
                                {item.details || '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {getTagNames(item).map((tagName, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800"
                                  >
                                    {tagName}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell className="sticky right-0 bg-background">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
})

EquipmentTable.displayName = 'EquipmentTable'
