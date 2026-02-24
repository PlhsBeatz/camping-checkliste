'use client'

import React, { useMemo, useState } from 'react'
import { Campingplatz } from '@/lib/db'
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
import { Search, Filter, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CampingplaetzeTableProps {
  items: Campingplatz[]
  onEdit: (item: Campingplatz) => void
  onDelete: (item: Campingplatz) => void
  showArchived?: boolean
}

export function CampingplaetzeTable({
  items,
  onEdit,
  onDelete,
  showArchived = false,
}: CampingplaetzeTableProps) {
  const [search, setSearch] = useState('')
  const [filterLand, setFilterLand] = useState<string>('all')
  const [filterBundesland, setFilterBundesland] = useState<string>('all')
  const [filterTyp, setFilterTyp] = useState<string>('all')
  const [filterArchiv, setFilterArchiv] = useState<string>(showArchived ? 'all' : 'active')
  const [showFilters, setShowFilters] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const lands = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((c) => c.land)
            .filter((x) => !!x)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [items]
  )

  const bundeslaender = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((c) => c.bundesland)
            .filter((x): x is string => !!x)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [items]
  )

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (filterArchiv === 'active' && item.is_archived) return false
      if (filterArchiv === 'archived' && !item.is_archived) return false
      if (filterLand !== 'all' && item.land !== filterLand) return false
      if (filterBundesland !== 'all' && (item.bundesland || '') !== filterBundesland) return false
      if (filterTyp !== 'all' && item.platz_typ !== filterTyp) return false
      if (search) {
        const q = search.toLowerCase()
        const text =
          `${item.name} ${item.ort} ${item.land} ${item.bundesland ?? ''} ${item.webseite ?? ''}`
        if (!text.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [items, filterArchiv, filterLand, filterBundesland, filterTyp, search])

  const grouped = useMemo(() => {
    const map: Record<
      string,
      {
        bundesland: string
        items: Campingplatz[]
      }
    > = {}
    for (const item of filtered) {
      const key = `${item.land}|||${item.bundesland ?? ''}`
      if (!map[key]) {
        map[key] = {
          bundesland: item.bundesland ?? '',
          items: [],
        }
      }
      map[key].items.push(item)
    }
    const entries = Object.entries(map).map(([key, value]) => {
      const [landRaw] = key.split('|||')
      const land = landRaw || ''
      const bundesland = value.bundesland || ''
      return {
        land,
        bundesland,
        items: value.items.sort(
          (a, b) => a.ort.localeCompare(b.ort) || a.name.localeCompare(b.name)
        ),
      }
    })
    entries.sort(
      (a, b) =>
        a.land.localeCompare(b.land) ||
        a.bundesland.localeCompare(b.bundesland)
    )
    return entries
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="space-y-4 bg-white border rounded-lg p-4 bg-muted/30">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, Ort oder Land..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="icon"
            onClick={() => setShowFilters((s) => !s)}
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Land</Label>
              <Select value={filterLand} onValueChange={setFilterLand}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {lands.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bundesland</Label>
              <Select value={filterBundesland} onValueChange={setFilterBundesland}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {bundeslaender.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Platz-Typ</Label>
              <Select value={filterTyp} onValueChange={setFilterTyp}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="Durchreise">Durchreise</SelectItem>
                  <SelectItem value="Urlaubsplatz">Urlaubsplatz</SelectItem>
                  <SelectItem value="Stellplatz">Stellplatz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filterArchiv} onValueChange={setFilterArchiv}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Nur aktive</SelectItem>
                  <SelectItem value="archived">Nur archivierte</SelectItem>
                  <SelectItem value="all">Alle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground flex items-center justify-between">
          <div>
            {filtered.length} von {items.length} Campingplätzen
            {(search ||
              filterLand !== 'all' ||
              filterBundesland !== 'all' ||
              filterTyp !== 'all' ||
              filterArchiv !== 'active') && (
              <Button
                variant="link"
                size="sm"
                className="ml-2 h-auto p-0"
                onClick={() => {
                  setSearch('')
                  setFilterLand('all')
                  setFilterBundesland('all')
                  setFilterTyp('all')
                  setFilterArchiv(showArchived ? 'all' : 'active')
                }}
              >
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        {grouped.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Keine Campingplätze gefunden.
          </div>
        ) : (
          <div className="divide-y">
            {grouped.map((group) => (
              <div key={`${group.land}-${group.bundesland}`} className="bg-muted/40">
                <div className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wide border-b">
                  {group.land}
                  {group.bundesland && ` – ${group.bundesland}`}
                </div>
                <div className="divide-y">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        'px-4 py-3 flex items-start justify-between gap-3',
                        item.is_archived && 'opacity-60 bg-muted/60'
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{item.name}</span>
                          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                            {item.platz_typ}
                          </span>
                          {item.is_archived && (
                            <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-xs">
                              Archiviert
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">
                          {item.ort}, {item.land}
                          {item.bundesland && ` (${item.bundesland})`}
                        </div>
                        {item.adresse && (
                          <div className="text-xs text-gray-500">{item.adresse}</div>
                        )}
                        {(item.webseite || item.video_link) && (
                          <div className="flex flex-wrap gap-2 text-xs mt-1">
                            {item.webseite && (
                              <button
                                type="button"
                                className="underline text-blue-600 hover:text-blue-800"
                                onClick={() => window.open(item.webseite!, '_blank')}
                              >
                                Webseite
                              </button>
                            )}
                            {item.video_link && (
                              <button
                                type="button"
                                className="underline text-blue-600 hover:text-blue-800"
                                onClick={() => window.open(item.video_link!, '_blank')}
                              >
                                Video
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <DropdownMenu
                        open={openMenuId === item.id}
                        onOpenChange={(o) => setOpenMenuId(o ? item.id : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
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
                              onDelete(item)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen / Archivieren
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

