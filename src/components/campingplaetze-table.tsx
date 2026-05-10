'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  Search,
  Filter,
  MoreVertical,
  Pencil,
  Trash2,
  Route,
  Globe2,
  PlayCircle,
  Star,
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { campingplatzListThumbnailSrc } from '@/lib/campingplatz-photo-url'
import { countryFlagEmojiForLandName } from '@/lib/country-flag-emoji'

interface CampingplaetzeTableProps {
  items: Campingplatz[]
  onEdit: (item: Campingplatz) => void
  onDelete: (item: Campingplatz) => void
  /** Zeile antippen → Detail (ohne Menü / externe Links) */
  onRowClick?: (item: Campingplatz) => void
  showArchived?: boolean
}

const PREFS_KEY = 'campingplaetze-table-prefs-v1'
type SortMode = 'region' | 'distance' | 'name'
type FilterWunsch = 'all' | 'wish' | 'nowish'
type FilterBesucht = 'all' | 'visited' | 'never'
type FilterCoords = 'all' | 'with'

interface TablePrefs {
  sortMode: SortMode
  filterWunsch: FilterWunsch
  filterBesucht: FilterBesucht
  filterCoords: FilterCoords
  maxFahrzeitMin: number | null
}

function loadPrefs(): Partial<TablePrefs> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<TablePrefs>
  } catch {
    return null
  }
}

const ROUTE_FETCH_CONCURRENCY = 4

function isAufWunschliste(item: Campingplatz): boolean {
  return (item as { aufwunschliste?: boolean }).aufwunschliste !== false
}

function isTopFavorit(item: Campingplatz): boolean {
  return !!(item as { top_favorit?: boolean }).top_favorit
}

function cmpTopThen(
  a: Campingplatz,
  b: Campingplatz,
  then: (a: Campingplatz, b: Campingplatz) => number
): number {
  const da = isTopFavorit(a) ? 1 : 0
  const db = isTopFavorit(b) ? 1 : 0
  if (db !== da) return db - da
  return then(a, b)
}

export function CampingplaetzeTable({
  items,
  onEdit,
  onDelete,
  onRowClick,
  showArchived = false,
}: CampingplaetzeTableProps) {
  const prefs0 = loadPrefs()
  const [search, setSearch] = useState('')
  const [filterLand, setFilterLand] = useState<string>('all')
  const [filterBundesland, setFilterBundesland] = useState<string>('all')
  const [filterTyp, setFilterTyp] = useState<string>('all')
  const [filterArchiv, setFilterArchiv] = useState<string>(showArchived ? 'all' : 'active')
  const [sortMode, setSortMode] = useState<SortMode>(prefs0?.sortMode ?? 'region')
  const [filterWunsch, setFilterWunsch] = useState<FilterWunsch>(prefs0?.filterWunsch ?? 'wish')
  const [filterBesucht, setFilterBesucht] = useState<FilterBesucht>(prefs0?.filterBesucht ?? 'all')
  const [filterCoords, setFilterCoords] = useState<FilterCoords>(prefs0?.filterCoords ?? 'all')
  const [maxFahrzeitMin, setMaxFahrzeitMin] = useState<number | null>(
    prefs0?.maxFahrzeitMin !== undefined ? prefs0.maxFahrzeitMin : null
  )
  const [showFilters, setShowFilters] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [landFilterScrollbarVisible, setLandFilterScrollbarVisible] = useState(false)
  const landScrollHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [extraDistances, setExtraDistances] = useState<
    Record<string, { distanceKm: number; durationMinutes: number }>
  >({})

  useEffect(() => {
    const toSave: TablePrefs = {
      sortMode,
      filterWunsch,
      filterBesucht,
      filterCoords,
      maxFahrzeitMin,
    }
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(toSave))
    } catch {
      /* ignore */
    }
  }, [sortMode, filterWunsch, filterBesucht, filterCoords, maxFahrzeitMin])

  const mergedDistances = useMemo(() => {
    const out: Record<string, { distanceKm: number; durationMinutes: number }> = {
      ...extraDistances,
    }
    for (const item of items) {
      const r = item.route_from_home
      if (r) {
        out[item.id] = {
          distanceKm: r.distanceKm,
          durationMinutes: r.durationMinutes,
        }
      }
    }
    return out
  }, [items, extraDistances])

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
      if (filterWunsch === 'wish' && !isAufWunschliste(item)) return false
      if (filterWunsch === 'nowish' && isAufWunschliste(item)) return false
      if (filterBesucht === 'visited' && (item.urlaube_zuordnungen ?? 0) === 0) return false
      if (filterBesucht === 'never' && (item.urlaube_zuordnungen ?? 0) > 0) return false
      if (filterCoords === 'with' && (item.lat == null || item.lng == null)) return false
      if (maxFahrzeitMin != null && maxFahrzeitMin > 0) {
        const min = mergedDistances[item.id]?.durationMinutes
        if (min == null) return false
        if (min > maxFahrzeitMin) return false
      }
      if (search) {
        const q = search.toLowerCase()
        const text =
          `${item.name} ${item.ort} ${item.land} ${item.bundesland ?? ''} ${item.webseite ?? ''}`
        if (!text.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [
    items,
    filterArchiv,
    filterLand,
    filterBundesland,
    filterTyp,
    filterWunsch,
    filterBesucht,
    filterCoords,
    maxFahrzeitMin,
    mergedDistances,
    search,
  ])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const inFlight = new Set<string>()

    const missing = filtered.filter((i) => {
      if (i.lat == null || i.lng == null) return false
      if (mergedDistances[i.id]) return false
      return true
    })

    const fetchOne = async (item: Campingplatz) => {
      if (cancelled || inFlight.has(item.id)) return
      inFlight.add(item.id)
      try {
        const res = await fetch('/api/routes/campingplatz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campingplatzId: item.id }),
          signal: ac.signal,
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          success?: boolean
          data?: { distanceKm: number; durationMinutes: number }
        }
        if (data.success && data.data && !cancelled) {
          setExtraDistances((prev) => {
            if (prev[item.id]) return prev
            return {
              ...prev,
              [item.id]: {
                distanceKm: data.data!.distanceKm,
                durationMinutes: data.data!.durationMinutes,
              },
            }
          })
        }
      } catch {
        /* Abbruch / offline */
      } finally {
        inFlight.delete(item.id)
      }
    }

    const run = async () => {
      for (let i = 0; i < missing.length && !cancelled; i += ROUTE_FETCH_CONCURRENCY) {
        const chunk = missing.slice(i, i + ROUTE_FETCH_CONCURRENCY)
        await Promise.all(chunk.map((c) => fetchOne(c)))
      }
    }
    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [filtered, mergedDistances])

  useEffect(() => {
    return () => {
      if (landScrollHideTimerRef.current) clearTimeout(landScrollHideTimerRef.current)
    }
  }, [])

  const onLandFilterScroll = () => {
    setLandFilterScrollbarVisible(true)
    if (landScrollHideTimerRef.current) clearTimeout(landScrollHideTimerRef.current)
    landScrollHideTimerRef.current = setTimeout(() => {
      setLandFilterScrollbarVisible(false)
      landScrollHideTimerRef.current = null
    }, 900)
  }

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
    return Object.values(map)
      .map((g) => ({
        ...g,
        items: g.items.slice().sort((a, b) =>
          cmpTopThen(a, b, (x, y) => x.ort.localeCompare(y.ort) || x.name.localeCompare(y.name))
        ),
      }))
      .sort((a, b) => {
        return (
          a.land.localeCompare(b.land) ||
          a.bundesland.localeCompare(b.bundesland) ||
          (a.items[0]?.ort || '').localeCompare(b.items[0]?.ort || '')
        )
      })
  }, [filtered])

  const flatSorted = useMemo(() => {
    const list = filtered.slice()
    if (sortMode === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
      return list
    }
    if (sortMode === 'distance') {
      list.sort((a, b) => {
        const dx = mergedDistances[a.id]?.distanceKm
        const dy = mergedDistances[b.id]?.distanceKm
        if (dx == null && dy == null) return a.name.localeCompare(b.name)
        if (dx == null) return 1
        if (dy == null) return -1
        if (dx !== dy) return dx - dy
        return a.name.localeCompare(b.name)
      })
      return list
    }
    return []
  }, [filtered, sortMode, mergedDistances])

  const filterArchivDefault = showArchived ? 'all' : 'active'
  const hasNonDefaultFilters =
    search ||
    filterLand !== 'all' ||
    filterBundesland !== 'all' ||
    filterTyp !== 'all' ||
    filterArchiv !== filterArchivDefault ||
    filterWunsch !== 'wish' ||
    filterBesucht !== 'all' ||
    filterCoords !== 'all' ||
    maxFahrzeitMin != null ||
    sortMode !== 'region'

  const resetFilters = () => {
    setSearch('')
    setFilterLand('all')
    setFilterBundesland('all')
    setFilterTyp('all')
    setFilterArchiv(showArchived ? 'all' : 'active')
    setFilterWunsch('wish')
    setFilterBesucht('all')
    setFilterCoords('all')
    setMaxFahrzeitMin(null)
    setSortMode('region')
  }

  const renderCard = (item: Campingplatz) => {
    const route = mergedDistances[item.id]
    const aufWunsch = isAufWunschliste(item)
    const top = isTopFavorit(item)
    return (
      <div
        key={item.id}
        className={cn(
          'bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-start justify-between gap-3',
          item.is_archived && 'opacity-60 bg-muted/60'
        )}
      >
        <div
          className={cn(
            'flex gap-3 flex-1 min-w-0 rounded-lg outline-none',
            onRowClick && 'cursor-pointer hover:bg-muted/30 -m-2 p-2 transition-colors'
          )}
          role={onRowClick ? 'button' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={() => onRowClick?.(item)}
          onKeyDown={(e) => {
            if (!onRowClick) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onRowClick(item)
            }
          }}
        >
          {(() => {
            const photoUrl = campingplatzListThumbnailSrc(item)
            return (
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt=""
                    width={48}
                    height={48}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] leading-tight text-muted-foreground px-1 text-center">
                    Kein Bild
                  </span>
                )}
              </div>
            )
          })()}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {top && (
                <span
                  className="inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 text-amber-800"
                  title="Top-Favorit"
                  aria-label="Top-Favorit"
                >
                  <Star className="h-3 w-3 fill-current" />
                </span>
              )}
              <span className="min-w-0 truncate font-semibold text-sm">{item.name}</span>
              {!aufWunsch && !item.is_archived && (
                <span className="inline-flex rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-[10px] font-medium">
                  Kein Wunschziel
                </span>
              )}
              {(item.urlaube_zuordnungen ?? 0) > 0 && (
                <span
                  className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold leading-none text-white tabular-nums"
                  aria-label={`${item.urlaube_zuordnungen} Urlaube zugeordnet`}
                >
                  {item.urlaube_zuordnungen}
                </span>
              )}
              {(item.webseite || item.video_link) && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  {item.webseite && (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted hover:text-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(item.webseite!, '_blank')
                      }}
                      aria-label="Webseite öffnen"
                      title="Webseite öffnen"
                    >
                      <Globe2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {item.video_link && (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted hover:text-blue-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(item.video_link!, '_blank')
                      }}
                      aria-label="Video öffnen"
                      title="Video öffnen"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
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
                  {route.durationMinutes != null &&
                    (() => {
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
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {item.webseite && (
                <DropdownMenuItem
                  onSelect={() => {
                    setOpenMenuId(null)
                    window.open(item.webseite!, '_blank')
                  }}
                >
                  <Globe2 className="h-4 w-4 mr-2" />
                  Webseite öffnen
                </DropdownMenuItem>
              )}
              {item.video_link && (
                <DropdownMenuItem
                  onSelect={() => {
                    setOpenMenuId(null)
                    window.open(item.video_link!, '_blank')
                  }}
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Video öffnen
                </DropdownMenuItem>
              )}
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
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 bg-white border rounded-lg p-4 bg-muted/30">
        {lands.length > 0 && (
          <div
            className={cn(
              'mb-1 flex gap-2 overflow-x-auto pb-1',
              !landFilterScrollbarVisible &&
                '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            )}
            onScroll={onLandFilterScroll}
          >
            <button
              type="button"
              onClick={() => setFilterLand('all')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs whitespace-nowrap',
                filterLand === 'all'
                  ? 'bg-[rgb(45,79,30)] text-white border-[rgb(45,79,30)]'
                  : 'bg-white text-gray-700 hover:bg-muted'
              )}
            >
              <span className="text-[1em] leading-none select-none" aria-hidden>
                🌍
              </span>
              Alle Länder
            </button>
            {lands.map((land) => {
              const flag = countryFlagEmojiForLandName(land)
              return (
                <button
                  key={land}
                  type="button"
                  onClick={() => setFilterLand(land)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs whitespace-nowrap',
                    filterLand === land
                      ? 'bg-[rgb(45,79,30)] text-white border-[rgb(45,79,30)]'
                      : 'bg-white text-gray-700 hover:bg-muted'
                  )}
                >
                  {flag ? (
                    <span className="text-[1em] leading-none select-none" aria-hidden>
                      {flag}
                    </span>
                  ) : null}
                  {land}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex flex-row gap-2 items-center">
          <div className="flex-1 relative min-w-0">
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
            className="shrink-0"
            onClick={() => setShowFilters((s) => !s)}
            aria-label="Filter, Sortierung und Kriterien ein- oder ausblenden"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-[rgb(45,79,30)]/30 bg-[rgb(45,79,30)]/10 px-3 py-3 dark:border-[rgb(45,79,30)]/45 dark:bg-[rgb(45,79,30)]/20">
              <Label
                htmlFor="cp-sort-mode"
                className="text-xs font-semibold text-[rgb(45,79,30)] dark:text-[rgb(180,200,165)]"
              >
                Sortierung
              </Label>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                <SelectTrigger
                  id="cp-sort-mode"
                  className="mt-1.5 w-full sm:max-w-md border-[rgb(45,79,30)]/20 bg-white/95 dark:border-[rgb(45,79,30)]/35 dark:bg-slate-950/60"
                >
                  <SelectValue placeholder="Sortierung wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="region">Region (Land/Bundesland)</SelectItem>
                  <SelectItem value="distance">Entfernung (von Zuhause)</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filterkriterien
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Label>Archiv</Label>
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
            <div>
              <Label>Wunschliste</Label>
              <Select
                value={filterWunsch}
                onValueChange={(v) => setFilterWunsch(v as FilterWunsch)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle aktiven</SelectItem>
                  <SelectItem value="wish">Nur auf Wunschliste</SelectItem>
                  <SelectItem value="nowish">Ohne Wunschliste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Besuche</Label>
              <Select
                value={filterBesucht}
                onValueChange={(v) => setFilterBesucht(v as FilterBesucht)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="visited">Schon besucht</SelectItem>
                  <SelectItem value="never">Noch nie besucht</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Koordinaten</Label>
              <Select
                value={filterCoords}
                onValueChange={(v) => setFilterCoords(v as FilterCoords)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="with">Nur mit Koordinaten</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Max. Fahrzeit (ab Zuhause)</Label>
              <Select
                value={maxFahrzeitMin == null ? 'all' : String(maxFahrzeitMin)}
                onValueChange={(v) => {
                  if (v === 'all') setMaxFahrzeitMin(null)
                  else setMaxFahrzeitMin(Number(v))
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Kein Limit</SelectItem>
                  <SelectItem value="60">Bis ca. 1 h</SelectItem>
                  <SelectItem value="90">Bis ca. 1:30 h</SelectItem>
                  <SelectItem value="120">Bis ca. 2 h</SelectItem>
                  <SelectItem value="150">Bis ca. 2:30 h</SelectItem>
                  <SelectItem value="180">Bis ca. 3 h</SelectItem>
                </SelectContent>
              </Select>
            </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground flex items-center justify-between">
          <div>
            {filtered.length} von {items.length} Campingplätzen
            {hasNonDefaultFilters && (
              <Button variant="link" size="sm" className="ml-2 h-auto p-0" onClick={resetFilters}>
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
        ) : sortMode === 'region' ? (
          <div className="space-y-4">
            {groupedByRegion.map((group) => (
              <div key={`${group.land}-${group.bundesland}`} className="space-y-2">
                <div className="text-xs font-semibold tracking-wide text-[rgb(45,79,30)] px-1 mt-2">
                  {group.bundesland || 'Ohne Bundesland'}
                  <span className="text-muted-foreground"> · {group.land}</span>
                </div>
                <div className="space-y-2">{group.items.map((item) => renderCard(item))}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">{flatSorted.map((item) => renderCard(item))}</div>
        )}
      </div>
    </div>
  )
}
