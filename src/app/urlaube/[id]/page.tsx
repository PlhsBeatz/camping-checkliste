'use client'

import { useAuth } from '@/components/auth-provider'
import { notifyVacationSearchParamChanged } from '@/hooks/use-vacation-search-param'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { VacationEditModal } from '@/components/vacation-edit-modal'
import { UrlaubOverviewMap } from '@/components/urlaub-overview-map'
import {
  ArrowLeft,
  ListChecks,
  Map as MapIcon,
  Menu,
  ChevronRight,
  MoreVertical,
  Pencil,
  Route,
  Trash2,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import { Vacation, Mitreisender, Campingplatz, VacationCampingStay, Rastplatz } from '@/lib/db'
import Image from 'next/image'
import { campingplatzListThumbnailSrc } from '@/lib/campingplatz-photo-url'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format, isSameMonth, isSameYear } from 'date-fns'
import { de } from 'date-fns/locale'
import {
  getCachedVacations,
  getCachedVacationMitreisende,
  getCachedRoute,
  getCachedSegmentRoute,
} from '@/lib/offline-sync'
import { cacheRoute, cacheSegmentRoute } from '@/lib/offline-db'
import {
  type CampingplatzRouteInfo,
  cacheEntryToRouteInfo,
  isDetailHomeRouteComplete,
  isSegmentRouteComplete,
  mergeCampingplatzRouteInfo,
  parseCampingplatzRouteApiData,
  recordRouteFetchAttempt,
  routeFetchKey,
  routeInfoToCacheEntry,
  routeInfoToSegmentCacheEntry,
  segmentCacheEntryToRouteInfo,
  shouldFetchRoute,
} from '@/lib/client-route-info'
import { isUsableRoutePolyline } from '@/lib/route-polyline'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'
import { getVacationCountdown } from '@/lib/vacation-helpers'
import { groupAllMitreisendeByGruppe } from '@/lib/pack-profile-groups'
import {
  buildReturnHomeSegment,
  buildVacationSegments,
  findHomeToFirstStaySegment,
  findSegmentForStayPair,
  getTravelLegPhases,
  type TravelLegPhase,
  type TravelSegment,
} from '@/lib/travel-segment'
import {
  countSegmentEmpfehlungen,
  openSegmentInAdacMaps,
  openSegmentInGoogleMaps,
} from '@/lib/maps-export'
import {
  getRastplaetzeAlongSegment,
  getVisibleRastplaetzeForExpandedSegments,
  resolveSegmentRastOpen,
  SegmentRastSuggestions,
  type SegmentRouteMatchOptions,
} from '@/components/segment-rast-suggestions'

function sanitizeRoutePolyline(encoded: string | null | undefined): string | null {
  return isUsableRoutePolyline(encoded) ? encoded!.trim() : null
}

function stayLegKey(fromStayId: string, toStayId: string) {
  return `${fromStayId}|${toStayId}`
}

function formatStayDateRange(start: string | null, end: string | null) {
  if (!start) return 'Kein Datum'
  const startDate = new Date(start)
  if (!end || end === start) {
    return format(startDate, 'd. MMM yyyy', { locale: de })
  }
  const endDate = new Date(end)
  const sameYear = isSameYear(startDate, endDate)
  const sameMonth = isSameMonth(startDate, endDate)
  if (sameYear && sameMonth) {
    return `${format(startDate, 'd.', { locale: de })}–${format(endDate, 'd. MMM yyyy', { locale: de })}`
  }
  if (sameYear) {
    return `${format(startDate, 'd. MMM', { locale: de })} – ${format(endDate, 'd. MMM yyyy', { locale: de })}`
  }
  return `${format(startDate, 'd. MMM yyyy', { locale: de })} – ${format(endDate, 'd. MMM yyyy', { locale: de })}`
}

function stayNights(start: string | null, end: string | null) {
  if (!start || !end) return 0
  const diff = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
  )
  return diff > 0 ? diff : 0
}

function formatVacationDateRange(start: string, end: string) {
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

function formatDurationMinutes(durationMinutes: number) {
  const hours = Math.floor(durationMinutes / 60)
  const minutes = Math.round(durationMinutes % 60)
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} h`)
  if (minutes > 0 || hours === 0) parts.push(`${minutes} min`)
  return parts.join(' ')
}

function CountdownHeader({ vacation }: { vacation: Vacation }) {
  const countdown = getVacationCountdown(vacation)
  const isPast = countdown.tone === 'past'

  return (
    <div
      className={cn(
        'rounded-t-lg px-4 py-2.5 text-center md:py-4',
        isPast
          ? 'bg-[hsl(103,32%,88%)] text-brand-heading dark:bg-green-950/50 dark:text-brand-heading'
          : 'bg-[rgb(45,79,30)] text-white'
      )}
    >
      <p className="text-lg font-bold tracking-tight md:text-2xl">{countdown.primary}</p>
      {countdown.secondary && (
        <p
          className={cn(
            'mt-0.5 text-xs md:text-sm',
            isPast ? 'opacity-80' : 'text-white/85'
          )}
        >
          {countdown.secondary}
        </p>
      )}
    </div>
  )
}

/** Routen-Abschnitt direkt auf dem Hintergrund (ohne Box) – zwischen zwei Stationen. */
function RouteLeg({
  label,
  route,
  segment,
  rastplaetze,
  routeMatch,
  rastOpen,
  onRastOpenToggle,
}: {
  label: string
  route: CampingplatzRouteInfo | undefined
  segment: TravelSegment | null
  rastplaetze: Rastplatz[]
  routeMatch?: SegmentRouteMatchOptions
  rastOpen: boolean
  onRastOpenToggle: () => void
}) {
  const rastCount = useMemo(() => {
    if (!segment) return 0
    return getRastplaetzeAlongSegment(segment, rastplaetze, routeMatch).length
  }, [routeMatch, segment, rastplaetze])

  const empfehlungsCount = useMemo(() => {
    if (!segment) return 0
    return countSegmentEmpfehlungen(segment, rastplaetze, routeMatch)
  }, [routeMatch, segment, rastplaetze])

  const hasRast = rastCount > 0
  const showRastPanel = hasRast && rastOpen

  const waypointHint =
    empfehlungsCount > 0
      ? ` (${empfehlungsCount} Empfehlung${empfehlungsCount === 1 ? '' : 'en'})`
      : ''

  return (
    <>
      <div className="flex items-center gap-2 py-1.5 pl-4 pr-1 text-xs text-muted-foreground">
        <div className="flex flex-col items-center self-stretch">
          <span className="w-px flex-1 bg-border" />
          <Route className="my-0.5 h-3.5 w-3.5 shrink-0 text-brand-heading" />
          <span className="w-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          disabled={!hasRast}
          onClick={hasRast ? onRastOpenToggle : undefined}
          className={cn(
            'min-w-0 flex-1 text-left',
            hasRast && 'cursor-pointer hover:text-foreground/80'
          )}
          aria-expanded={hasRast ? rastOpen : undefined}
          aria-label={
            hasRast ? (rastOpen ? 'Rastplätze ausblenden' : 'Rastplätze anzeigen') : undefined
          }
        >
          <span className="font-medium text-foreground/70">{label}</span>
          {route ? (
            <span className="ml-1.5">
              {Math.round(route.distanceKm)} km · {formatDurationMinutes(route.durationMinutes)}
            </span>
          ) : (
            <span className="ml-1.5 italic opacity-70">Route wird berechnet…</span>
          )}
          {hasRast && (
            <ChevronRight
              className={cn(
                'ml-1 inline h-3 w-3 shrink-0 align-middle opacity-60 transition-transform',
                rastOpen && 'rotate-90'
              )}
              aria-hidden
            />
          )}
        </button>
        {segment && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                aria-label="Routenoptionen"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-30">
              <DropdownMenuItem
                onSelect={() =>
                  openSegmentInGoogleMaps(
                    segment,
                    rastplaetze,
                    undefined,
                    routeMatch?.encodedPolyline,
                    routeMatch?.routeProvider
                  )
                }
              >
                <MapIcon className="h-4 w-4 mr-2" />
                Google Maps{waypointHint}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  openSegmentInAdacMaps(
                    segment,
                    rastplaetze,
                    undefined,
                    routeMatch?.encodedPolyline,
                    routeMatch?.routeProvider
                  )
                }
              >
                <Route className="h-4 w-4 mr-2" />
                ADAC Routenplanung{waypointHint}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {showRastPanel && segment ? (
        <SegmentRastSuggestions
          segment={segment}
          rastplaetze={rastplaetze}
          routeMatch={routeMatch}
        />
      ) : null}
    </>
  )
}

export default function UrlaubDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const router = useRouter()
  const { user, loading, canAccessConfig } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [vacation, setVacation] = useState<Vacation | null>(null)
  const [mitreisende, setMitreisende] = useState<Mitreisender[]>([])
  const [campingplaetze, setCampingplaetze] = useState<Campingplatz[]>([])
  const [stays, setStays] = useState<VacationCampingStay[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [routeInfo, setRouteInfo] = useState<Record<string, CampingplatzRouteInfo>>({})
  const [segmentRouteInfo, setSegmentRouteInfo] = useState<
    Record<string, CampingplatzRouteInfo>
  >({})
  const segmentRouteInfoRef = useRef(segmentRouteInfo)
  segmentRouteInfoRef.current = segmentRouteInfo
  const [homeCoords, setHomeCoords] = useState<{
    lat: number
    lng: number
    label?: string
  } | null>(null)
  const [rastplaetze, setRastplaetze] = useState<Rastplatz[]>([])
  const routeInfoRef = useRef(routeInfo)
  routeInfoRef.current = routeInfo

  const load = useCallback(async () => {
    if (!id) return
    setLoadError(null)
    try {
      const res = await fetch(`/api/vacations/${id}`)
      const data = (await res.json()) as ApiResponse<{
        vacation: Vacation
        mitreisende: Mitreisender[]
        campingplaetze: Campingplatz[]
        stays?: VacationCampingStay[]
      }>
      if (!data.success || !data.data) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getCachedVacations()
          const v = cached.find((c) => c.id === id)
          if (v) {
            setVacation(v)
            setMitreisende(await getCachedVacationMitreisende(id))
            setCampingplaetze([])
            setStays([])
            return
          }
        }
        setLoadError(data.error ?? 'Nicht gefunden')
        setVacation(null)
        setMitreisende([])
        setCampingplaetze([])
        setStays([])
        return
      }
      setVacation(data.data.vacation)
      setMitreisende(data.data.mitreisende)
      setCampingplaetze(data.data.campingplaetze)
      setStays(data.data.stays ?? [])
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const cached = await getCachedVacations()
        const v = cached.find((c) => c.id === id)
        if (v) {
          setVacation(v)
          setMitreisende(await getCachedVacationMitreisende(id))
          setCampingplaetze([])
          setStays([])
          return
        }
      }
      setLoadError('Laden fehlgeschlagen')
      setVacation(null)
      setMitreisende([])
      setCampingplaetze([])
      setStays([])
    }
  }, [id])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    void load()
  }, [load])

  useReconnectRefetch(load)

  useEffect(() => {
    let aborted = false
    void (async () => {
      try {
        const res = await fetch('/api/profile/home-location')
        const data = (await res.json()) as ApiResponse<{
          heimat_adresse: string | null
          heimat_lat: number | null
          heimat_lng: number | null
        }>
        if (aborted) return
        if (
          data.success &&
          data.data?.heimat_lat != null &&
          data.data.heimat_lng != null
        ) {
          setHomeCoords({
            lat: data.data.heimat_lat,
            lng: data.data.heimat_lng,
            label: data.data.heimat_adresse ?? 'Heimatadresse',
          })
        } else {
          setHomeCoords(null)
        }
      } catch {
        if (!aborted) setHomeCoords(null)
      }
    })()
    return () => {
      aborted = true
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/rastplaetze')
        const j = (await r.json()) as ApiResponse<Rastplatz[]>
        if (j.success && j.data) setRastplaetze(j.data)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const sortedStays = useMemo(
    () => [...stays].sort((a, b) => (a.sort_index ?? 0) - (b.sort_index ?? 0)),
    [stays]
  )

  const travelSegments = useMemo(
    () => buildVacationSegments(sortedStays, homeCoords),
    [sortedStays, homeCoords]
  )

  const returnHomeSegment = useMemo(() => {
    const lastStay = sortedStays[sortedStays.length - 1]
    if (!homeCoords || !lastStay) return null
    return buildReturnHomeSegment(lastStay, homeCoords)
  }, [sortedStays, homeCoords])

  const travelLegPhases = useMemo(() => {
    if (!vacation) return new Map<string, TravelLegPhase>()
    return getTravelLegPhases(vacation, sortedStays, travelSegments, returnHomeSegment)
  }, [vacation, sortedStays, travelSegments, returnHomeSegment])

  const [segmentRastExpanded, setSegmentRastExpanded] = useState<Record<string, boolean>>({})

  const toggleSegmentRast = useCallback((segmentId: string, phase: TravelLegPhase) => {
    setSegmentRastExpanded((prev) => ({
      ...prev,
      [segmentId]: !resolveSegmentRastOpen(segmentId, phase, prev),
    }))
  }, [])

  const allTravelSegments = useMemo(() => {
    const list = [...travelSegments]
    if (returnHomeSegment) list.push(returnHomeSegment)
    return list
  }, [travelSegments, returnHomeSegment])

  const segmentRouteMatchBySegmentId = useMemo(() => {
    const map = new Map<string, SegmentRouteMatchOptions>()
    const firstStay = sortedStays[0]
    const lastStay = sortedStays[sortedStays.length - 1]

    if (firstStay) {
      const homeSeg = findHomeToFirstStaySegment(travelSegments, firstStay.id)
      const homeRoute = routeInfo[firstStay.campingplatz.id]
      if (homeSeg && homeRoute) {
        map.set(homeSeg.id, {
          encodedPolyline: sanitizeRoutePolyline(homeRoute.encodedPolyline),
          routeProvider: homeRoute.provider ?? null,
        })
      }
    }

    for (let i = 0; i < sortedStays.length - 1; i++) {
      const fromStay = sortedStays[i]
      const toStay = sortedStays[i + 1]
      if (!fromStay || !toStay || fromStay.campingplatz.id === toStay.campingplatz.id) continue
      const seg = findSegmentForStayPair(travelSegments, fromStay.id, toStay.id)
      const legRoute = segmentRouteInfo[stayLegKey(fromStay.id, toStay.id)]
      if (seg && legRoute) {
        map.set(seg.id, {
          encodedPolyline: sanitizeRoutePolyline(legRoute.encodedPolyline),
          routeProvider: legRoute.provider ?? null,
        })
      }
    }

    if (returnHomeSegment && lastStay) {
      const returnRoute = routeInfo[lastStay.campingplatz.id]
      if (returnRoute) {
        const forwardPolyline = sanitizeRoutePolyline(returnRoute.encodedPolyline)
        const returnPolyline = sanitizeRoutePolyline(returnRoute.returnEncodedPolyline)
        const roundTripSameCamp =
          !!firstStay && firstStay.campingplatz.id === lastStay.campingplatz.id
        const polylines = roundTripSameCamp
          ? [returnPolyline, forwardPolyline]
          : [returnPolyline]
        const usable = polylines.filter((p): p is string => !!p)
        if (usable.length > 0) {
          map.set(returnHomeSegment.id, {
            encodedPolyline: usable[0],
            alternateEncodedPolylines: usable.slice(1),
            routeProvider: returnRoute.provider ?? null,
          })
        } else if (returnRoute.provider === 'haversine') {
          map.set(returnHomeSegment.id, {
            routeProvider: 'haversine',
          })
        }
      }
    }

    return map
  }, [sortedStays, travelSegments, returnHomeSegment, routeInfo, segmentRouteInfo])

  const mapVisibleRastplaetze = useMemo(
    () =>
      getVisibleRastplaetzeForExpandedSegments(
        allTravelSegments,
        rastplaetze,
        travelLegPhases,
        segmentRastExpanded,
        segmentRouteMatchBySegmentId
      ),
    [
      allTravelSegments,
      rastplaetze,
      travelLegPhases,
      segmentRastExpanded,
      segmentRouteMatchBySegmentId,
    ]
  )

  const vacationCampingplatzIds = useMemo(
    () => new Set(sortedStays.map((s) => s.campingplatz.id)),
    [sortedStays]
  )

  const vacationCampingplatzIdsKey = useMemo(
    () => [...vacationCampingplatzIds].sort().join(','),
    [vacationCampingplatzIds]
  )

  const campingRouteIdsNeedingFetch = useMemo(() => {
    const ids: string[] = []
    for (const cpId of vacationCampingplatzIds) {
      const fetchKey = routeFetchKey('camping', cpId)
      if (!isDetailHomeRouteComplete(routeInfo[cpId], fetchKey)) ids.push(cpId)
    }
    return ids
  }, [vacationCampingplatzIds, routeInfo])

  const campingRouteIdsNeedingFetchKey = useMemo(
    () => campingRouteIdsNeedingFetch.join(','),
    [campingRouteIdsNeedingFetch]
  )

  const stayLegPairs = useMemo(() => {
    const pairs: Array<{
      key: string
      fromId: string
      toId: string
    }> = []
    for (let i = 0; i < sortedStays.length - 1; i++) {
      const fromStay = sortedStays[i]
      const toStay = sortedStays[i + 1]
      if (!fromStay || !toStay) continue
      const from = fromStay.campingplatz
      const to = toStay.campingplatz
      if (from.id === to.id) continue
      if (!from.lat || !from.lng || !to.lat || !to.lng) continue
      pairs.push({
        key: stayLegKey(fromStay.id, toStay.id),
        fromId: from.id,
        toId: to.id,
      })
    }
    return pairs
  }, [sortedStays])

  const stayLegPairsKey = useMemo(() => stayLegPairs.map((p) => p.key).join(','), [stayLegPairs])

  const segmentLegKeysNeedingFetch = useMemo(() => {
    const keys: string[] = []
    for (const pair of stayLegPairs) {
      const fetchKey = routeFetchKey('segment', pair.key)
      if (!isSegmentRouteComplete(segmentRouteInfo[pair.key], fetchKey)) keys.push(pair.key)
    }
    return keys
  }, [stayLegPairs, segmentRouteInfo])

  const segmentLegKeysNeedingFetchKey = useMemo(
    () => segmentLegKeysNeedingFetch.join(','),
    [segmentLegKeysNeedingFetch]
  )

  // Heimat↔Campingplatz: zuerst Offline-Cache, dann begrenzte API-Calls
  useEffect(() => {
    if (!user?.id || !vacationCampingplatzIdsKey) return
    let aborted = false
    const userId = user.id

    void (async () => {
      for (const cpId of vacationCampingplatzIdsKey.split(',')) {
        if (aborted || !cpId) return
        const fetchKey = routeFetchKey('camping', cpId)
        if (isDetailHomeRouteComplete(routeInfoRef.current[cpId], fetchKey)) continue
        const cached = await getCachedRoute(userId, cpId)
        if (!cached || aborted) continue
        setRouteInfo((prev) => ({
          ...prev,
          [cpId]: mergeCampingplatzRouteInfo(prev[cpId], cacheEntryToRouteInfo(cached)),
        }))
      }
    })()

    return () => {
      aborted = true
    }
  }, [user?.id, vacationCampingplatzIdsKey])

  useEffect(() => {
    if (!user?.id || !campingRouteIdsNeedingFetchKey || campingplaetze.length === 0) return
    let aborted = false
    const controller = new AbortController()
    const userId = user.id

    const loadRoutes = async () => {
      for (const cpId of campingRouteIdsNeedingFetchKey.split(',')) {
        if (aborted || !cpId) return
        const fetchKey = routeFetchKey('camping', cpId)
        if (!shouldFetchRoute(fetchKey)) continue
        const cp = campingplaetze.find((c) => c.id === cpId)
        if (!cp?.lat || !cp.lng) continue
        recordRouteFetchAttempt(fetchKey)
        try {
          const res = await fetch('/api/routes/campingplatz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campingplatzId: cp.id }),
            signal: controller.signal,
          })
          if (!res.ok || aborted) continue
          const data = (await res.json()) as {
            success?: boolean
            data?: CampingplatzRouteInfo & {
              provider?: 'google' | 'haversine'
              encodedPolyline?: string | null
              returnEncodedPolyline?: string | null
            }
          }
          const incoming = parseCampingplatzRouteApiData(data.data)
          if (!data.success || !incoming || aborted) continue
          setRouteInfo((prev) => ({
            ...prev,
            [cp.id]: mergeCampingplatzRouteInfo(prev[cp.id], incoming),
          }))
          try {
            await cacheRoute(userId, routeInfoToCacheEntry(userId, cp.id, incoming))
          } catch (cacheErr) {
            console.warn('cacheRoute failed:', cacheErr)
          }
        } catch {
          if (aborted) return
        }
      }
    }

    void loadRoutes()
    return () => {
      aborted = true
      controller.abort()
    }
  }, [user?.id, campingplaetze, campingRouteIdsNeedingFetchKey])

  // Segment-Routen: Offline-Cache, dann begrenzte API-Calls
  useEffect(() => {
    if (!stayLegPairsKey) return
    let aborted = false

    void (async () => {
      for (const pair of stayLegPairs) {
        if (aborted) return
        const fetchKey = routeFetchKey('segment', pair.key)
        if (isSegmentRouteComplete(segmentRouteInfoRef.current[pair.key], fetchKey)) continue
        const cached = await getCachedSegmentRoute(pair.fromId, pair.toId)
        if (!cached || aborted) continue
        setSegmentRouteInfo((prev) => ({
          ...prev,
          [pair.key]: mergeCampingplatzRouteInfo(
            prev[pair.key],
            segmentCacheEntryToRouteInfo(cached)
          ),
        }))
      }
    })()

    return () => {
      aborted = true
    }
  }, [stayLegPairs, stayLegPairsKey])

  useEffect(() => {
    if (!segmentLegKeysNeedingFetchKey) return
    let aborted = false
    const controller = new AbortController()

    const loadSegments = async () => {
      for (const pair of stayLegPairs) {
        if (aborted) return
        if (!segmentLegKeysNeedingFetch.includes(pair.key)) continue
        const fetchKey = routeFetchKey('segment', pair.key)
        if (!shouldFetchRoute(fetchKey)) continue
        recordRouteFetchAttempt(fetchKey)
        try {
          const res = await fetch('/api/routes/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromId: pair.fromId, toId: pair.toId }),
            signal: controller.signal,
          })
          if (!res.ok || aborted) continue
          const data = (await res.json()) as {
            success?: boolean
            data?: CampingplatzRouteInfo & {
              provider?: 'google' | 'haversine'
              encodedPolyline?: string | null
            }
          }
          const incoming = parseCampingplatzRouteApiData(data.data)
          if (!data.success || !incoming || aborted) continue
          setSegmentRouteInfo((prev) => ({
            ...prev,
            [pair.key]: mergeCampingplatzRouteInfo(prev[pair.key], incoming),
          }))
          try {
            await cacheSegmentRoute(routeInfoToSegmentCacheEntry(pair.fromId, pair.toId, incoming))
          } catch (cacheErr) {
            console.warn('cacheSegmentRoute failed:', cacheErr)
          }
        } catch {
          if (aborted) return
        }
      }
    }

    void loadSegments()
    return () => {
      aborted = true
      controller.abort()
    }
  }, [stayLegPairs, segmentLegKeysNeedingFetch, segmentLegKeysNeedingFetchKey])

  const mitreisendeByGruppe = useMemo(
    () => groupAllMitreisendeByGruppe(mitreisende),
    [mitreisende]
  )

  const mapCampingplaetze = useMemo(
    () =>
      campingplaetze
        .filter((cp) => cp.lat != null && cp.lng != null)
        .map((cp) => ({
          id: cp.id,
          lat: cp.lat!,
          lng: cp.lng!,
          name: cp.name,
        })),
    [campingplaetze]
  )

  const executeDelete = async () => {
    if (!vacation) return
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/vacations?id=${vacation.id}`, { method: 'DELETE' })
      const data = (await res.json()) as ApiResponse<boolean>
      if (!data.success) {
        alert('Fehler beim Löschen: ' + (data.error ?? 'Unbekannt'))
      } else {
        router.push('/urlaube')
      }
    } catch {
      alert('Fehler beim Löschen des Urlaubs.')
    } finally {
      setDeleteBusy(false)
      setShowDeleteConfirm(false)
    }
  }

  const subtitle = vacation
    ? formatVacationDateRange(vacation.startdatum, vacation.enddatum)
    : '—'

  if (!id) return null

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 transition-all duration-300 min-w-0', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-20 shrink-0 flex items-center justify-between gap-3 bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden flex-shrink-0"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-brand-heading truncate">
                  {vacation?.titel ?? 'Urlaub'}
                </h1>
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              </div>
            </div>
            {canAccessConfig && vacation && (
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
                <DropdownMenuContent align="end" className="z-30 min-w-[10rem]">
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {loadError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm">
              {loadError}
            </div>
          )}

          {!vacation && !loadError && (
            <div className="flex justify-center py-16 text-muted-foreground">Laden…</div>
          )}

          {vacation && (
            <>
              <div className="hidden flex-wrap gap-2 md:flex">
                <Button variant="outline" size="sm" className="bg-card hover:bg-muted" asChild>
                  <Link
                    href="/urlaube"
                    className="inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    Zur Liste
                  </Link>
                </Button>
              </div>

              <Card className="overflow-hidden rounded-lg border shadow-sm bg-card">
                <CountdownHeader vacation={vacation} />
                <CardContent className="space-y-6 p-4 pt-4 md:p-6 md:pt-6">
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-brand-heading">Reisedaten</h2>
                    <dl className="space-y-2 text-sm">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-muted-foreground shrink-0">Reisezeitraum:</dt>
                        <dd>{formatVacationDateRange(vacation.startdatum, vacation.enddatum)}</dd>
                      </div>
                      {vacation.abfahrtdatum && (
                        <div className="flex flex-wrap gap-x-2">
                          <dt className="text-muted-foreground shrink-0">Reisebeginn (Abfahrt):</dt>
                          <dd>
                            {format(new Date(vacation.abfahrtdatum), 'd. LLLL yyyy', {
                              locale: de,
                            })}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-brand-heading flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" aria-hidden />
                      Mitreisende
                    </h2>
                    {mitreisende.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine Mitreisenden zugeordnet.</p>
                    ) : (
                      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-8 sm:gap-y-4">
                        {mitreisendeByGruppe.map((group) => (
                          <div key={group.id} className="flex flex-col gap-2 min-w-0">
                            {mitreisendeByGruppe.length > 1 && (
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                {group.name}
                              </p>
                            )}
                            <ul className="flex flex-wrap gap-2">
                              {group.members.map((m) => (
                                <li
                                  key={m.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-subtle bg-card px-3 py-1 text-sm shadow-sm"
                                >
                                  {m.farbe && (
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: m.farbe }}
                                      aria-hidden
                                    />
                                  )}
                                  {m.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-brand-heading">Campingplätze</h2>
                    {sortedStays.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Noch keine Campingplätze zugeordnet.
                      </p>
                    ) : (
                      <div>
                        {(() => {
                          const firstStay = sortedStays[0]
                          const homeSegment =
                            firstStay &&
                            findHomeToFirstStaySegment(travelSegments, firstStay.id)
                          return homeCoords && firstStay && firstStay.campingplatz.lat != null ? (
                            <>
                              <RouteLeg
                                label="Von zu Hause"
                                route={routeInfo[firstStay.campingplatz.id]}
                                segment={homeSegment ?? null}
                                rastplaetze={rastplaetze}
                                routeMatch={
                                  homeSegment
                                    ? segmentRouteMatchBySegmentId.get(homeSegment.id)
                                    : undefined
                                }
                                rastOpen={
                                  homeSegment
                                    ? resolveSegmentRastOpen(
                                        homeSegment.id,
                                        travelLegPhases.get(homeSegment.id) ?? 'future',
                                        segmentRastExpanded
                                      )
                                    : false
                                }
                                onRastOpenToggle={() => {
                                  if (!homeSegment) return
                                  toggleSegmentRast(
                                    homeSegment.id,
                                    travelLegPhases.get(homeSegment.id) ?? 'future'
                                  )
                                }}
                              />
                            </>
                          ) : null
                        })()}
                        {sortedStays.map((stay, index) => {
                          const cp = stay.campingplatz
                          const photoUrl = campingplatzListThumbnailSrc(cp)
                          const nights = stayNights(stay.start_datum, stay.end_datum)
                          const next = sortedStays[index + 1]
                          const showLeg =
                            next &&
                            next.campingplatz.id !== cp.id &&
                            cp.lat != null &&
                            next.campingplatz.lat != null
                          return (
                            <div key={stay.id}>
                              <Link
                                href={`/campingplaetze/${cp.id}`}
                                className={cn(
                                  'bg-card rounded-xl border border-subtle shadow-sm px-3 py-2 flex gap-3 items-start transition-colors hover:bg-muted',
                                  cp.is_archived && 'opacity-60 bg-muted/60'
                                )}
                              >
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
                                <div className="space-y-1 min-w-0 flex-1">
                                  <span className="font-semibold text-sm truncate block">
                                    {cp.name}
                                  </span>
                                  <div className="text-xs text-gray-600">
                                    {cp.ort}, {cp.land}
                                    {cp.bundesland && ` (${cp.bundesland})`}
                                  </div>
                                  <div className="text-xs font-medium text-brand-heading">
                                    {formatStayDateRange(stay.start_datum, stay.end_datum)}
                                    {nights > 0 &&
                                      ` · ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}`}
                                  </div>
                                </div>
                              </Link>
                              {showLeg && next && (
                                <>
                                  {(() => {
                                    const legSegment = findSegmentForStayPair(
                                      travelSegments,
                                      stay.id,
                                      next.id
                                    )
                                    const legPhase = legSegment
                                      ? travelLegPhases.get(legSegment.id) ?? 'future'
                                      : 'future'
                                    return (
                                      <>
                                        <RouteLeg
                                          label="Weiterfahrt"
                                          route={
                                            segmentRouteInfo[stayLegKey(stay.id, next.id)]
                                          }
                                          segment={legSegment}
                                          rastplaetze={rastplaetze}
                                          routeMatch={
                                            legSegment
                                              ? segmentRouteMatchBySegmentId.get(legSegment.id)
                                              : undefined
                                          }
                                          rastOpen={
                                            legSegment
                                              ? resolveSegmentRastOpen(
                                                  legSegment.id,
                                                  legPhase,
                                                  segmentRastExpanded
                                                )
                                              : false
                                          }
                                          onRastOpenToggle={() => {
                                            if (!legSegment) return
                                            toggleSegmentRast(legSegment.id, legPhase)
                                          }}
                                        />
                                      </>
                                    )
                                  })()}
                                </>
                              )}
                              {next && next.campingplatz.id === cp.id && (
                                <div className="py-1.5 pl-4 text-xs italic text-muted-foreground">
                                  Aufenthalt am selben Platz
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {(() => {
                          const lastStay = sortedStays[sortedStays.length - 1]
                          return homeCoords && lastStay && lastStay.campingplatz.lat != null ? (
                            <>
                              <RouteLeg
                                label="Zurück nach Hause"
                                route={routeInfo[lastStay.campingplatz.id]}
                                segment={returnHomeSegment}
                                rastplaetze={rastplaetze}
                                routeMatch={
                                  returnHomeSegment
                                    ? segmentRouteMatchBySegmentId.get(returnHomeSegment.id)
                                    : undefined
                                }
                                rastOpen={
                                  returnHomeSegment
                                    ? resolveSegmentRastOpen(
                                        returnHomeSegment.id,
                                        travelLegPhases.get(returnHomeSegment.id) ?? 'future',
                                        segmentRastExpanded
                                      )
                                    : false
                                }
                                onRastOpenToggle={() => {
                                  if (!returnHomeSegment) return
                                  toggleSegmentRast(
                                    returnHomeSegment.id,
                                    travelLegPhases.get(returnHomeSegment.id) ?? 'future'
                                  )
                                }}
                              />
                            </>
                          ) : null
                        })()}
                      </div>
                    )}
                    {(mapCampingplaetze.length > 0 || homeCoords) && (
                      <UrlaubOverviewMap
                        home={homeCoords}
                        campingplaetze={mapCampingplaetze}
                        rastplaetze={mapVisibleRastplaetze.map((r) => ({
                          id: r.id,
                          lat: r.lat!,
                          lng: r.lng!,
                          name: r.name,
                          bewertung: r.bewertung,
                        }))}
                        title={vacation.titel}
                      />
                    )}
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-brand-heading flex items-center gap-2">
                      <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
                      Packliste
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Standardansicht:{' '}
                      {vacation.packliste_default_ansicht === 'alles'
                        ? 'Alles anzeigen'
                        : 'Nur Packliste'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-card hover:bg-muted"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          sessionStorage.setItem('packlistVacationId', vacation.id)
                        }
                        router.push(`/?vacation=${vacation.id}`)
                        notifyVacationSearchParamChanged()
                      }}
                    >
                      Packliste öffnen
                    </Button>
                  </section>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {vacation && (
        <VacationEditModal
          open={editOpen}
          onOpenChange={setEditOpen}
          vacationId={vacation.id}
          onSaved={({ vacation: saved, campingplaetze: savedCamping }) => {
            setVacation(saved)
            setCampingplaetze(savedCamping)
            void load()
          }}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Urlaub löschen"
        description="Möchten Sie diesen Urlaub wirklich löschen? Die zugehörige Packliste wird ebenfalls entfernt."
        onConfirm={executeDelete}
        isLoading={deleteBusy}
      />
    </div>
  )
}
