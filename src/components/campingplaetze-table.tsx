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
import { Search, Filter, MoreVertical, Pencil, Trash2, Route } from 'lucide-react'
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
  const [distances, setDistances] = useState<
    Record<string, { distanceKm: number; durationMinutes: number }>
  >({})

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

  // Distanz zur Heimatadresse über bestehende Route-API laden (pro Campingplatz, mit Caching).
  React.useEffect(() => {
    let aborted = false
    const controller = new AbortController()

    const loadDistances = async () => {
      for (const item of filtered) {
        if (aborted) break
        if (item.lat == null || item.lng == null) continue
        if (distances[item.id]) continue
        try {
          const res = await fetch('/api/routes/campingplatz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campingplatzId: item.id }),
            signal: controller.signal,
          })
          if (!res.ok) continue
          const data = (await res.json()) as {
            success?: boolean
            data?: { distanceKm: number; durationMinutes: number }
          }
          if (data.success && data.data && !aborted) {
            setDistances((prev) => ({
              ...prev,
              [item.id]: {
                distanceKm: data.data!.distanceKm,
                durationMinutes: data.data!.durationMinutes,
              },
            }))
          }
        } catch {
          if (aborted) return
        }
      }
    }

    void loadDistances()
    return () => {
      aborted = true
      controller.abort()
    }
  }, [filtered, distances])

  const groupedByRegion = useMemo(() => {
    const map: Record<
      string,
      {
        land: string
        bundesland: string
        items: Campingplatz[]
      }
    > = {}
    for (const item of filtered) {
      const land = item.land || ''
      const bundesland = item.bundesland ?? ''
      const key = `${land}|||${bundesland}`
      if (!map[key]) {
        map[key] = { land, bundesland, items: [] }
      }
      map[key].items.push(item)
    }
    return Object.values(map).sort((a, b) => {
      return (
        a.land.localeCompare(b.land) ||
        a.bundesland.localeCompare(b.bundesland) ||
        (a.items[0]?.ort || '').localeCompare(b.items[0]?.ort || '')
      )
    })
  }, [filtered])

  return (
    <div className="space-y-4">
      <div className="space-y-4 bg-white border rounded-lg p-4 bg-muted/30">
        {lands.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-1">
            <button
              type="button"
              onClick={() => setFilterLand('all')}
              className={cn(
                'px-3 py-1 rounded-full border text-xs whitespace-nowrap',
                filterLand === 'all'
                  ? 'bg-[rgb(45,79,30)] text-white border-[rgb(45,79,30)]'
                  : 'bg-white text-gray-700 hover:bg-muted'
              )}
            >
              Alle Länder
            </button>
            {lands.map((land) => (
              <button
                key={land}
                type="button"
                onClick={() => setFilterLand(land)}
                className={cn(
                  'px-3 py-1 rounded-full border text-xs whitespace-nowrap',
                  filterLand === land
                    ? 'bg-[rgb(45,79,30)] text-white border-[rgb(45,79,30)]'
                    : 'bg-white text-gray-700 hover:bg-muted'
                )}
              >
                {land}
              </button>
            ))}
          </div>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            Keine Campingplätze gefunden.
          </div>
        ) : (
          <div className="space-y-4">
            {groupedByRegion.map((group) => (
              <div key={`${group.land}-${group.bundesland}`} className="space-y-2">
                <div className="text-xs font-semibold tracking-wide text-[rgb(45,79,30)] px-1 mt-2">
                  {group.bundesland || 'Ohne Bundesland'}
                  <span className="text-muted-foreground"> · {group.land}</span>
                </div>
                <div className="space-y-2">
                  {group.items
                    .slice()
                    .sort(
                      (a, b) =>
                        a.ort.localeCompare(b.ort) || a.name.localeCompare(b.name)
                    )
                    .map((item) => {
                      const route = distances[item.id]
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-start justify-between gap-3',
                            item.is_archived && 'opacity-60 bg-muted/60'
                          )}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{item.name}</span>
                            </div>
                            <div className="text-xs text-gray-600">
                              {item.ort}, {item.land}
                              {item.bundesland && ` (${item.bundesland})`}
                            </div>
                            {route && (
                              <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                                <Route className="h-3.5 w-3.5 text-[rgb(45,79,30)]" />
                                <span>
                                  {Math.round(route.distanceKm)} km
                                  {route.durationMinutes != null && (() => {
                                    const hours = Math.floor(route.durationMinutes / 60)
                                    const minutes = Math.round(route.durationMinutes % 60)
                                    const parts: string[] = []
                                    if (hours > 0) parts.push(`${hours} h`)
                                    if (minutes > 0 || hours === 0) parts.push(`${minutes} min`)
                                    return ` · ${parts.join(' ')}`
                                  })()}
                                </span>
                              </div>
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
                          <div className="flex flex-col items-end gap-2">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                              {item.platz_typ}
                            </span>
                            {item.is_archived && (
                              <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-xs">
                                Archiviert
                              </span>
                            )}
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
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

