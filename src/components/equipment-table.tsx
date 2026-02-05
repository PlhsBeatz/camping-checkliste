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
import { Pencil, Trash2, Search, Filter, Star } from 'lucide-react'
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
        const itemMainCategory = getMainCategoryName(item.kategorie_id)
        const filterMainCategoryName = mainCategories.find(mc => mc.id === filterMainCategory)?.titel
        if (itemMainCategory !== filterMainCategoryName) {
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
  }, [equipmentItems, searchTerm, filterMainCategory, filterTransport, filterStatus, mainCategories, getMainCategoryName])

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, EquipmentItem[]> = {}
    
    filteredItems.forEach(item => {
      const categoryName = getCategoryName(item.kategorie_id)
      if (!groups[categoryName]) {
        groups[categoryName] = []
      }
      groups[categoryName].push(item)
    })

    // Sort categories alphabetically
    return Object.keys(groups)
      .sort()
      .map(categoryName => ({
        categoryName,
        items: groups[categoryName]
      }))
  }, [filteredItems, getCategoryName])

  // Status badge colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Immer gepackt': return 'bg-green-100 text-green-800'
      case 'Immer dabei': return 'bg-blue-100 text-blue-800'
      case 'Optional': return 'bg-gray-100 text-gray-800'
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
                      {tv.icon} {tv.name}
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

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[250px]">Was</TableHead>
                <TableHead className="w-[150px]">Kategorie</TableHead>
                <TableHead className="w-[120px]">Transport</TableHead>
                <TableHead className="w-[100px]">Gewicht</TableHead>
                <TableHead className="w-[80px]">Anzahl</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[150px]">Tags</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Keine Ausrüstungsgegenstände gefunden
                  </TableCell>
                </TableRow>
              ) : (
                groupedItems.map(group => (
                  <>
                    {/* Category Header */}
                    <TableRow key={`header-${group.categoryName}`} className="bg-muted/50">
                      <TableCell colSpan={8} className="font-semibold">
                        {group.categoryName} ({group.items.length})
                      </TableCell>
                    </TableRow>
                    {/* Items */}
                    {group.items.map(item => (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {item.is_standard && (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            )}
                            <span>{item.was}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getMainCategoryName(item.kategorie_id)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getTransportName(item.transport_id)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.einzelgewicht ? `${item.einzelgewicht}g` : '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.standard_anzahl}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status}
                          </span>
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
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(item)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
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
