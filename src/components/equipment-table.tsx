'use client'

import { useState, useMemo, useCallback } from 'react'
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

export function EquipmentTable({
  equipmentItems,
  categories,
  mainCategories,
  transportVehicles,
  tags,
  onEdit,
  onDelete,
}: EquipmentTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMainCategory, setFilterMainCategory] = useState<string>('all')
  const [filterTransport, setFilterTransport] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
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
    return item.tags.map(tagId => {
      const tag = tags.find(t => t.id === tagId.id)
      return tag?.titel || ''
    }).filter(Boolean)
  }

  // Format weight in kg with German decimal format
  const formatWeight = (weightInGrams: number | null) => {
    if (!weightInGrams) return '-'
    const kg = weightInGrams / 1000
    return `${kg.toFixed(3).replace('.', ',')} kg`
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

      // Transport filter
      if (filterTransport !== 'all') {
        if (filterTransport === 'none' && item.transport_id !== null) {
          return false
        }
        if (filterTransport !== 'none' && item.transport_id !== filterTransport) {
          return false
        }
      }

      // Status filter
      if (filterStatus !== 'all' && item.status !== filterStatus) {
        return false
      }

      return true
    })
  }, [equipmentItems, searchTerm, filterMainCategory, filterTransport, filterStatus, getMainCategoryId])

  // Group by main category and then by category with sticky headers
  const groupedItems = useMemo(() => {
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

    // Sort main categories and categories alphabetically
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
      case 'Immer gepackt': return 'bg-green-100 text-green-800'
      case 'Immer dabei': return 'bg-blue-100 text-blue-800'
      case 'Optional': return 'bg-gray-100 text-gray-800'
      case 'Ausgemustert': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
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
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="Immer gepackt">Immer gepackt</SelectItem>
                  <SelectItem value="Immer dabei">Immer dabei</SelectItem>
                  <SelectItem value="Optional">Optional</SelectItem>
                  <SelectItem value="Ausgemustert">Ausgemustert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="text-sm text-muted-foreground">
          {filteredItems.length} von {equipmentItems.length} Einträgen
          {(searchTerm || filterMainCategory !== 'all' || filterTransport !== 'all' || filterStatus !== 'all') && (
            <Button
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0"
              onClick={() => {
                setSearchTerm('')
                setFilterMainCategory('all')
                setFilterTransport('all')
                setFilterStatus('all')
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
      </div>

      {/* Table - Mobile responsive with horizontal scroll */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-20 border-b">
              <TableRow>
                <TableHead className="min-w-[200px]">Was</TableHead>
                <TableHead className="min-w-[100px]">Transport</TableHead>
                <TableHead className="min-w-[100px]">Gewicht</TableHead>
                <TableHead className="min-w-[80px]">Anzahl</TableHead>
                <TableHead className="min-w-[120px]">Status</TableHead>
                <TableHead className="min-w-[200px] max-w-[300px]">Details</TableHead>
                <TableHead className="min-w-[150px]">Tags</TableHead>
                <TableHead className="min-w-[60px]">Links</TableHead>
                <TableHead className="min-w-[80px] sticky right-0 bg-background">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Keine Ausrüstungsgegenstände gefunden
                  </TableCell>
                </TableRow>
              ) : (
                groupedItems.map(mainGroup => (
                  <>
                    {/* Main Category Header - Sticky */}
                    <TableRow 
                      key={`main-${mainGroup.mainCategoryName}`} 
                      className="bg-[rgb(45,79,30)] text-white sticky z-10"
                      style={{ top: '40px' }}
                    >
                      <TableCell colSpan={9} className="font-bold text-base py-3">
                        {mainGroup.mainCategoryName}
                      </TableCell>
                    </TableRow>
                    {mainGroup.categories.map(group => (
                      <>
                        {/* Category Header - Sticky below main category */}
                        <TableRow 
                          key={`header-${group.categoryName}`} 
                          className="bg-muted/70 sticky z-10"
                          style={{ top: '80px' }}
                        >
                          <TableCell colSpan={9} className="font-semibold py-2">
                            {group.categoryName} ({group.items?.length || 0})
                          </TableCell>
                        </TableRow>
                        {/* Items */}
                        {group.items?.map(item => (
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
                              {item.links && item.links.length > 0 && (
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
                                        onClick={() => window.open(link.url, '_blank')}
                                        className="cursor-pointer"
                                      >
                                        <ExternalLink className="h-3 w-3 mr-2" />
                                        {link.url.length > 40 ? link.url.substring(0, 40) + '...' : link.url}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                            <TableCell className="sticky right-0 bg-background">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => onEdit(item)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Bearbeiten
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => onDelete(item.id)}
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
                      </>
                    ))}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
