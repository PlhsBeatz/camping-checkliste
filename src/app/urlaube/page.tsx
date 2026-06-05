'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { VacationEditModal } from '@/components/vacation-edit-modal'
import {
  Archive,
  Plus,
  Menu,
  MoreVertical,
  Pencil,
  Trash2,
  Route,
  Calendar as CalendarIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Suspense, useState, useEffect, useRef, useMemo } from 'react'
import { Vacation, Campingplatz } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'

/** Maximale gleichzeitige Routen-API-Anfragen (Campingplatz → Entfernung/Dauer). */
const ROUTE_INFO_FETCH_CONCURRENCY = 6

type CampingplatzRouteInfo = {
  distanceKm: number
  durationMinutes: number
  provider: string
}
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { campingplatzListThumbnailSrc } from '@/lib/campingplatz-photo-url'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCachedVacations, getCachedCampingplaetze } from '@/lib/offline-sync'
import { cacheVacations, cacheCampingplaetze } from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { notifyVacationSearchParamChanged } from '@/hooks/use-vacation-search-param'
import { format, isSameMonth, isSameYear } from 'date-fns'
import { de } from 'date-fns/locale'
import Image from 'next/image'

function UrlaubePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filterCampingplatzId = searchParams.get('campingplatz')
  const [vacationsViewMode, setVacationsViewMode] = useState<'aktuell' | 'archiv'>(() =>
    filterCampingplatzId ? 'archiv' : 'aktuell'
  )
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacations, setVacations] = useState<Vacation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewVacationDialog, setShowNewVacationDialog] = useState(false)
  const [editingVacationId, setEditingVacationId] = useState<string | null>(null)
  const [deleteVacationId, setDeleteVacationId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [vacationCampingplaetze, setVacationCampingplaetze] = useState<Record<string, Campingplatz[]>>(
    {}
  )
  const [allCampingplaetze, setAllCampingplaetze] = useState<Campingplatz[]>([])
  const [routeInfo, setRouteInfo] = useState<Record<string, CampingplatzRouteInfo>>({})
  const routeInfoRef = useRef(routeInfo)
  routeInfoRef.current = routeInfo

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

  // Refetch-Tick: bei Reconnect bumpen → die nachfolgenden useEffects mit Cache-Anbindung neu auslösen.
  const [refetchTick, setRefetchTick] = useState(0)
  useReconnectRefetch(() => setRefetchTick((t) => t + 1))

  // Fetch Vacations
  useEffect(() => {
    const fetchVacations = async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = (await res.json()) as ApiResponse<Vacation[]>
        if (data.success && data.data) {
          setVacations(data.data)
          await cacheVacations(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch vacations:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedVacations()
          if (cached.length > 0) setVacations(cached)
        }
      }
    }
    fetchVacations()
  }, [refetchTick])

  // Campingplätze für alle Urlaube laden (lazy)
  useEffect(() => {
    const loadCamping = async () => {
      try {
        const resAll = await fetch('/api/campingplaetze')
        const dataAll = (await resAll.json()) as ApiResponse<Campingplatz[]>
        if (dataAll.success && dataAll.data) {
          setAllCampingplaetze(dataAll.data)
          try {
            await cacheCampingplaetze(dataAll.data)
          } catch (e) {
            console.warn('cacheCampingplaetze failed:', e)
          }
        }
      } catch (error) {
        console.error('Failed to fetch campingplaetze:', error)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedCampingplaetze()
          if (cached.length > 0) setAllCampingplaetze(cached)
        }
      }
    }
    void loadCamping()
  }, [refetchTick])

  useEffect(() => {
    const controller = new AbortController()
    const loadAllAssignments = async () => {
      if (vacations.length === 0) {
        setVacationCampingplaetze({})
        return
      }
      try {
        const res = await fetch('/api/vacations/campingplaetze', {
          signal: controller.signal,
        })
        const payload = (await res.json()) as ApiResponse<Record<string, Campingplatz[]>>
        if (!payload.success || !payload.data) {
          const empty: Record<string, Campingplatz[]> = {}
          for (const v of vacations) empty[v.id] = []
          setVacationCampingplaetze(empty)
          return
        }
        const fromApi = payload.data
        const map: Record<string, Campingplatz[]> = {}
        for (const v of vacations) {
          map[v.id] = fromApi[v.id] ?? []
        }
        setVacationCampingplaetze(map)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to fetch vacation camping assignments:', error)
        const empty: Record<string, Campingplatz[]> = {}
        for (const v of vacations) empty[v.id] = []
        setVacationCampingplaetze(empty)
      }
    }
    void loadAllAssignments()
    return () => controller.abort()
  }, [vacations])

  // Routeninfo (Entfernung / Fahrzeit) für alle in Urlaube eingebundenen Campingplätze lazy laden
  useEffect(() => {
    let aborted = false
    const controller = new AbortController()

    const loadRoutes = async () => {
      const seen = new Set<string>()
      const pending: Campingplatz[] = []
      for (const cp of Object.values(vacationCampingplaetze).flat()) {
        if (!cp.lat || !cp.lng) continue
        if (seen.has(cp.id)) continue
        seen.add(cp.id)
        if (routeInfoRef.current[cp.id]) continue
        pending.push(cp)
      }

      const fetchOne = async (cp: Campingplatz) => {
        if (aborted) return
        try {
          const res = await fetch('/api/routes/campingplatz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campingplatzId: cp.id }),
            signal: controller.signal,
          })
          if (!res.ok || aborted) return
          const data = (await res.json()) as {
            success?: boolean
            data?: CampingplatzRouteInfo
          }
          if (!data.success || !data.data) return
          setRouteInfo((prev) =>
            prev[cp.id]
              ? prev
              : {
                  ...prev,
                  [cp.id]: data.data!,
                }
          )
        } catch {
          if (aborted) return
        }
      }

      for (let i = 0; i < pending.length; i += ROUTE_INFO_FETCH_CONCURRENCY) {
        if (aborted) break
        await Promise.all(pending.slice(i, i + ROUTE_INFO_FETCH_CONCURRENCY).map((cp) => fetchOne(cp)))
      }
    }

    void loadRoutes()
    return () => {
      aborted = true
      controller.abort()
    }
  }, [vacationCampingplaetze])

  const campingAssignmentsReady =
    vacations.length === 0 ||
    vacations.every((v) => vacationCampingplaetze[v.id] !== undefined)

  // Sortierung: Hauptliste „Aktuell“ aufsteigend nach Start; Archiv und Campingplatz-Filtern immer absteigend.
  const displayedVacations = useMemo(() => {
    let list = [...vacations]

    if (filterCampingplatzId) {
      list = list.filter((v) =>
        (vacationCampingplaetze[v.id] ?? []).some((c) => c.id === filterCampingplatzId)
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoffDate = new Date(today)
    cutoffDate.setDate(cutoffDate.getDate() - 7)

    if (vacationsViewMode === 'aktuell') {
      list = list.filter((v) => {
        const endDate = new Date(v.enddatum)
        endDate.setHours(0, 0, 0, 0)
        return endDate >= cutoffDate
      })
    }

    const byStartAsc = (a: Vacation, b: Vacation) =>
      new Date(a.startdatum).getTime() - new Date(b.startdatum).getTime()
    const byStartDesc = (a: Vacation, b: Vacation) =>
      new Date(b.startdatum).getTime() - new Date(a.startdatum).getTime()

    if (filterCampingplatzId || vacationsViewMode === 'archiv') {
      list.sort(byStartDesc)
    } else {
      list.sort(byStartAsc)
    }

    return list
  }, [vacations, vacationCampingplaetze, filterCampingplatzId, vacationsViewMode])

  const filterCampingplatzName = useMemo(() => {
    if (!filterCampingplatzId) return null
    return allCampingplaetze.find((c) => c.id === filterCampingplatzId)?.name ?? null
  }, [filterCampingplatzId, allCampingplaetze])

  const handleEditVacation = (vacation: Vacation, fromDropdown = false) => {
    setEditingVacationId(vacation.id)
    if (fromDropdown) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShowNewVacationDialog(true))
      })
    } else {
      setShowNewVacationDialog(true)
    }
  }

  const handleDeleteVacation = (vacationId: string) => {
    setDeleteVacationId(vacationId)
  }

  const executeDeleteVacation = async () => {
    if (!deleteVacationId) return
    const vacationId = deleteVacationId

    setIsLoading(true)
    try {
      const res = await fetch(`/api/vacations?id=${vacationId}`, {
        method: 'DELETE'
      })
      const data = (await res.json()) as ApiResponse<boolean>
      if (data.success) {
        setVacations(vacations.filter(v => v.id !== vacationId))
      } else {
        alert('Fehler beim Löschen des Urlaubs: ' + (data.error ?? 'Unbekannt'))
      }
    } catch (error) {
      console.error('Failed to delete vacation:', error)
      alert('Fehler beim Löschen des Urlaubs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectVacation = (vacationId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('packlistVacationId', vacationId)
    }
    router.push(`/?vacation=${vacationId}`)
    notifyVacationSearchParamChanged()
  }

  // Verhindert, dass der Card-Touch (nach Dropdown-Auswahl) als Klick zählt – nur auf Mobile relevant
  const ignoreNextCardClickRef = useRef(false)

  const handleCardClick = (vacationId: string) => {
    if (ignoreNextCardClickRef.current) {
      ignoreNextCardClickRef.current = false
      return
    }
    router.push(`/urlaube/${vacationId}`)
  }

  const formatVacationDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const sameYear = isSameYear(startDate, endDate)
    const sameMonth = isSameMonth(startDate, endDate)

    const dayStart = format(startDate, 'd.', { locale: de })
    const dayEnd = format(endDate, 'd.', { locale: de })

    if (sameYear && sameMonth) {
      const monthYear = format(endDate, 'LLLL yyyy', { locale: de })
      return `${dayStart} bis ${dayEnd} ${monthYear}`
    }

    if (sameYear && !sameMonth) {
      const partStart = format(startDate, 'd. LLLL', { locale: de })
      const partEnd = format(endDate, 'd. LLLL yyyy', { locale: de })
      return `${partStart} bis ${partEnd}`
    }

    const fullStart = format(startDate, 'd. LLLL yyyy', { locale: de })
    const fullEnd = format(endDate, 'd. LLLL yyyy', { locale: de })
    return `${fullStart} bis ${fullEnd}`
  }

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      {/* Navigation Sidebar */}
      <NavigationSidebar
        isOpen={showNavSidebar}
        onClose={() => setShowNavSidebar(false)}
      />

      {/* Main Content Area */}
      <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Mobile Menu Toggle */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Meine Urlaube
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {vacationsViewMode === 'aktuell'
                    ? filterCampingplatzId
                      ? 'Zukünftige und bis zu 7 Tage zurück (neuestes Datum zuerst)'
                      : 'Zukünftige und bis zu 7 Tage zurückliegende Reisen'
                    : filterCampingplatzId
                      ? 'Alle Zuordnungen zu diesem Platz (neuestes Datum zuerst)'
                      : 'Alle Urlaube (neuestes Datum zuerst)'}
                </p>
              </div>
            </div>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full border-0 bg-transparent text-foreground shadow-none hover:bg-neutral-100 focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]/30"
                  aria-label="Weitere Aktionen"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-20 min-w-[10rem]">
                {vacationsViewMode === 'archiv' ? (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => setVacationsViewMode('aktuell')}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    Nächste Urlaube
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onSelect={() => setVacationsViewMode('archiv')}
                  >
                    <Archive className="h-4 w-4 shrink-0" />
                    Urlaubsarchiv
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <VacationEditModal
            open={showNewVacationDialog}
            onOpenChange={(open) => {
              setShowNewVacationDialog(open)
              if (!open) setEditingVacationId(null)
            }}
            vacationId={editingVacationId}
            onSaved={({ vacation, campingplaetze, isNew }) => {
              if (isNew) {
                setVacations((prev) => [...prev, vacation])
                router.push(`/urlaube/${vacation.id}`)
              } else {
                setVacations((prev) =>
                  prev.map((v) => (v.id === vacation.id ? vacation : v))
                )
              }
              setVacationCampingplaetze((prev) => ({
                ...prev,
                [vacation.id]: campingplaetze,
              }))
            }}
          />

          {/* Urlaub löschen – Bestätigung */}
          <ConfirmDialog
            open={!!deleteVacationId}
            onOpenChange={(open) => !open && setDeleteVacationId(null)}
            title="Urlaub löschen"
            description="Sind Sie sicher, dass Sie diesen Urlaub löschen möchten?"
            onConfirm={executeDeleteVacation}
            isLoading={isLoading}
          />

          {/* Vacations List */}
          <div className="grid gap-4 min-w-0">
            {filterCampingplatzId && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="min-w-0 text-muted-foreground">
                  Urlaube mit{' '}
                  <span className="font-medium text-foreground">
                    {filterCampingplatzName ?? 'diesem Campingplatz'}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 bg-card"
                  onClick={() => router.replace('/urlaube')}
                >
                  Alle Urlaube
                </Button>
              </div>
            )}

            {filterCampingplatzId && !campingAssignmentsReady ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  Campingzuordnungen werden geladen…
                </CardContent>
              </Card>
            ) : displayedVacations.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    {filterCampingplatzId
                      ? 'Keine Urlaube mit diesem Campingplatz.'
                      : 'Keine Urlaube vorhanden. Erstellen Sie einen neuen Urlaub!'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              displayedVacations.map((vacation) => (
                <Card
                  key={vacation.id}
                  className="cursor-pointer hover:shadow-md transition-shadow min-w-0 overflow-hidden"
                  onClick={() => handleCardClick(vacation.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle>{vacation.titel}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          <div className="space-y-1 mt-2">
                            {vacation.abfahrtdatum && (
                              <p>
                                🚗 Reisebeginn:{' '}
                                {format(new Date(vacation.abfahrtdatum), 'd. LLLL yyyy', {
                                  locale: de,
                                })}
                              </p>
                            )}
                            <p>
                              📅 {formatVacationDateRange(vacation.startdatum, vacation.enddatum)}
                            </p>
                            {(vacationCampingplaetze[vacation.id] ?? []).length === 0 && (
                              <p className="text-sm">
                                ⛺ Noch keine Campingplätze zugeordnet
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu modal={false} open={openMenuId === vacation.id} onOpenChange={(o) => setOpenMenuId(o ? vacation.id : null)}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={() => {
                              ignoreNextCardClickRef.current = true
                              setOpenMenuId(null)
                              handleEditVacation(vacation, true)
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              ignoreNextCardClickRef.current = true
                              setOpenMenuId(null)
                              handleDeleteVacation(vacation.id)
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectVacation(vacation.id)
                      }}
                    >
                      Packliste öffnen
                    </Button>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Campingplätze</span>
                      </div>
                      <div className="space-y-1">
                        {(vacationCampingplaetze[vacation.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Noch keine Campingplätze zugeordnet.
                          </p>
                        ) : (
                          (vacationCampingplaetze[vacation.id] ?? []).map((cp) => {
                            const r = routeInfo[cp.id]
                            return (
                              <div
                                key={cp.id}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  'bg-card rounded-xl border border-subtle shadow-sm px-3 py-2 flex items-start justify-between gap-3 cursor-pointer transition-colors hover:bg-muted',
                                  cp.is_archived && 'opacity-60 bg-muted/60'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/campingplaetze/${cp.id}`)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    router.push(`/campingplaetze/${cp.id}`)
                                  }
                                }}
                              >
                                <div className="flex gap-3 flex-1 min-w-0">
                                  {(() => {
                                    const photoUrl = campingplatzListThumbnailSrc(cp)
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
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm truncate">
                                        {cp.name}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {cp.ort}, {cp.land}
                                      {cp.bundesland && ` (${cp.bundesland})`}
                                    </div>
                                    {r && (
                                      <div className="flex items-center gap-1 text-xs text-gray-600 mt-0.5">
                                        <Route className="h-3.5 w-3.5 text-brand-heading" />
                                        <span>
                                          {Math.round(r.distanceKm)} km
                                          {r.durationMinutes != null && (() => {
                                            const hours = Math.floor(r.durationMinutes / 60)
                                            const minutes = Math.round(r.durationMinutes % 60)
                                            const parts: string[] = []
                                            if (hours > 0) parts.push(`${hours} h`)
                                            if (minutes > 0 || hours === 0)
                                              parts.push(`${minutes} min`)
                                            return ` · ${parts.join(' ')}`
                                          })()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* FAB: Neuer Urlaub - Plus-Symbol, runder Kreis wie Ausrüstung und Packliste */}
        <div className="fixed bottom-6 right-6 z-30">
          <Button
            size="icon"
            onClick={() => {
              setEditingVacationId(null)
              setShowNewVacationDialog(true)
            }}
            className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow bg-[rgb(45,79,30)] hover:bg-[rgb(45,79,30)]/90 text-white aspect-square p-0"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        </div>
      </div>

    </div>
  )
}

/** Remount wenn sich der Campingplatz-Filter ändert, damit clientseitiges Navigieren /urlaube ↔ ?campingplatz= nie veralteten View-Modus übernimmt. */
function UrlaubePageGate() {
  const searchParams = useSearchParams()
  const campingFilter = searchParams.get('campingplatz') ?? ''
  return <UrlaubePageContent key={campingFilter} />
}

export default function UrlaubePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          Laden…
        </div>
      }
    >
      <UrlaubePageGate />
    </Suspense>
  )
}
