'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { SonnenAusrichtungCompass } from '@/components/sonnen-ausrichtung-compass'
import { SonnenAusrichtungMap } from '@/components/sonnen-ausrichtung-map'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  Menu,
  MapPin,
  Compass,
  Map as MapIcon,
  RotateCw,
  RotateCcw,
  ChevronRight,
  Move,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  extractCompassHeadingDeg,
  normalizeHeadingDeg,
  type DeviceOrientationEventWithWebkit,
} from '@/lib/device-compass-heading'
import { getCachedLastPosition, getCachedTransportVehicles } from '@/lib/offline-sync'
import { cacheLastPosition } from '@/lib/offline-db'
import {
  readSonnenBasemapPref,
  writeSonnenBasemapPref,
  readSonnenDisplayPref,
  writeSonnenDisplayPref,
  type SonnenBasemap,
  type SonnenDisplayMode,
} from '@/lib/satellite-tiles'
import { prefetchSatelliteAround } from '@/lib/satellite-tile-cache'
import {
  normalizeHeadingDeg as normalizeCaravanHeading,
  resolveCaravanOutline,
} from '@/lib/caravan-geometry'
import { resolvePlacementLengthM } from '@/lib/wohnwagen-hersteller'
import { supportsGrundriss } from '@/lib/transport-types'
import { buildPlatzplanUrl } from '@/lib/platzplan-url'
import type { ApiResponse } from '@/lib/api-types'
import type { TransportVehicle, Vacation, VacationCampingStay } from '@/lib/db'
import { CalendarDatePicker } from '@/components/ui/calendar-date-picker'
import { todayInAppTimezone } from '@/lib/app-timezone'

/** Kürzeste Winkeldifferenz (robust gegen 0°/360°-Sprünge, kein JS-%-Bug) */
function shortestAngleDiff(from: number, to: number): number {
  let diff = to - from
  while (diff > 180) diff -= 360
  while (diff < -180) diff += 360
  return diff
}

type ToolMode = 'vor-ort' | 'planung'

/** Aktiver Urlaub (heute im Zeitraum) oder nächster kommender. */
function pickDefaultVacationId(vacations: Vacation[], today: string): string {
  if (vacations.length === 0) return ''
  const active = vacations.find(
    (v) => v.startdatum <= today && v.enddatum >= today
  )
  if (active) return active.id
  const upcoming = [...vacations]
    .filter((v) => v.startdatum > today)
    .sort((a, b) => a.startdatum.localeCompare(b.startdatum))
  if (upcoming[0]) return upcoming[0].id
  // Fallback: jüngster / erster in Liste
  return vacations[0]?.id ?? ''
}

/** Aktiver Aufenthalt oder nächster kommender innerhalb der Stay-Liste. */
function pickDefaultStayId(stays: VacationCampingStay[], today: string): string {
  if (stays.length === 0) return ''
  const active = stays.find((s) => {
    const start = s.start_datum?.slice(0, 10)
    const end = s.end_datum?.slice(0, 10)
    if (!start || !end) return false
    return start <= today && end >= today
  })
  if (active) return active.id
  const upcoming = stays
    .filter((s) => {
      const start = s.start_datum?.slice(0, 10)
      return !!start && start > today
    })
    .sort((a, b) =>
      (a.start_datum ?? '').localeCompare(b.start_datum ?? '')
    )
  if (upcoming[0]) return upcoming[0].id
  return stays[0]?.id ?? ''
}

function formatShortDate(ymd: string | null | undefined): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.slice(0, 10).split('-')
  if (!y || !m || !d) return ymd
  return `${d}.${m}.${y}`
}

function SonnenAusrichtungContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [mode, setMode] = useState<ToolMode>(() =>
    searchParams.get('mode') === 'planung' ? 'planung' : 'vor-ort'
  )
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [isLoadingGps, setIsLoadingGps] = useState(true)
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null)
  const [smoothedHeading, setSmoothedHeading] = useState<number | null>(null)
  const smoothedRef = useRef<number | null>(null)
  const rawFilteredRef = useRef<number | null>(null)
  const targetHeadingRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const [compassEnabled, setCompassEnabled] = useState(false)
  const [compassPermissionNeeded, setCompassPermissionNeeded] = useState(false)

  const [displayMode, setDisplayMode] = useState<SonnenDisplayMode>('karte')
  const [basemap, setBasemap] = useState<SonnenBasemap>('satellite')
  const [satelliteHint, setSatelliteHint] = useState<string | null>(null)

  const [vacations, setVacations] = useState<Vacation[]>([])
  const [selectedVacationId, setSelectedVacationId] = useState<string>('')
  const [stays, setStays] = useState<VacationCampingStay[]>([])
  const [selectedStayId, setSelectedStayId] = useState<string>('')
  const [planDate, setPlanDate] = useState(todayInAppTimezone())
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [caravanHeading, setCaravanHeading] = useState(0)
  const [savingStellplatz, setSavingStellplatz] = useState(false)
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([])
  const [vacationTransportIds, setVacationTransportIds] = useState<string[] | null>(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [planPickerOpen, setPlanPickerOpen] = useState(false)
  const [caravanMoveMode, setCaravanMoveMode] = useState(false)
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)
  const vacationDefaultApplied = useRef(false)
  const modeDefaultApplied = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(pointer: coarse)')
    const sync = () => setIsCoarsePointer(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [])

  const requestCompassPermission = useCallback(async () => {
    if (typeof window === 'undefined') return
    const DOE = (window as Window & {
      DeviceOrientationEvent?: {
        requestPermission?: () => Promise<string>
      }
    }).DeviceOrientationEvent
    if (DOE?.requestPermission) {
      try {
        const result = await DOE.requestPermission()
        if (result === 'granted') {
          setCompassEnabled(true)
          setCompassPermissionNeeded(false)
        }
      } catch (err) {
        console.error('Compass permission denied:', err)
      }
    } else {
      setCompassEnabled(true)
    }
  }, [])

  // Prefs
  useEffect(() => {
    setDisplayMode(readSonnenDisplayPref())
    setBasemap(readSonnenBasemapPref())
  }, [])

  // Deep-link
  useEffect(() => {
    const m = searchParams.get('mode')
    const stayId = searchParams.get('stayId')
    if (m === 'planung') setMode('planung')
    if (stayId) {
      setMode('planung')
      setSelectedStayId(stayId)
    }
  }, [searchParams])

  // GPS
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    getCachedLastPosition()
      .then((cached) => {
        if (cancelled || !cached) return
        setPosition((prev) => prev ?? cached)
      })
      .catch(() => {})

    if (!navigator.geolocation) {
      setGpsError('GPS wird von diesem Browser nicht unterstützt.')
      setIsLoadingGps(false)
      return () => {
        cancelled = true
      }
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition(next)
        setGpsError(null)
        cacheLastPosition(next.lat, next.lng).catch(() => {})
      },
      (err) => {
        if (err.code === 1) {
          setGpsError('Standortzugriff wurde verweigert.')
        } else if (err.code === 2) {
          setGpsError('Standort konnte nicht ermittelt werden.')
        } else {
          setGpsError('Standortfehler: ' + err.message)
        }
      },
      { enableHighAccuracy: true, maximumAge: 60000 }
    )
    setIsLoadingGps(false)
    return () => {
      cancelled = true
      navigator.geolocation?.clearWatch(watchId)
    }
  }, [])

  // Compass
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('DeviceOrientationEvent' in window) && !('ondeviceorientation' in window)) {
      return
    }
    const handler = (event: Event) => {
      const raw = extractCompassHeadingDeg(event as DeviceOrientationEventWithWebkit)
      if (raw == null) return
      const prev = rawFilteredRef.current
      const RAW_LERP = 0.28
      rawFilteredRef.current =
        prev == null ? raw : normalizeHeadingDeg(prev + shortestAngleDiff(prev, raw) * RAW_LERP)
      setDeviceHeading(rawFilteredRef.current)
    }
    const useAbsolute = 'ondeviceorientationabsolute' in window
    if (useAbsolute) {
      window.addEventListener('deviceorientationabsolute', handler)
    }
    window.addEventListener('deviceorientation', handler)
    return () => {
      if (useAbsolute) {
        window.removeEventListener('deviceorientationabsolute', handler)
      }
      window.removeEventListener('deviceorientation', handler)
    }
  }, [])

  targetHeadingRef.current = deviceHeading
  useEffect(() => {
    if (deviceHeading == null) {
      setSmoothedHeading(null)
      smoothedRef.current = null
      rawFilteredRef.current = null
      targetHeadingRef.current = null
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }
    if (smoothedRef.current == null) {
      smoothedRef.current = deviceHeading
      setSmoothedHeading(deviceHeading)
    }
    const DISPLAY_SMOOTH = 0.07
    const tick = () => {
      const target = targetHeadingRef.current
      if (target == null) return
      const current = smoothedRef.current ?? target
      const diff = shortestAngleDiff(current, target)
      const next = normalizeHeadingDeg(current + diff * DISPLAY_SMOOTH)
      smoothedRef.current = next
      setSmoothedHeading(next)
      rafRef.current = requestAnimationFrame(tick)
    }
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [deviceHeading])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const DOE = (window as Window & {
      DeviceOrientationEvent?: {
        requestPermission?: () => Promise<string>
      }
    }).DeviceOrientationEvent
    if (!DOE && !('ondeviceorientation' in window)) {
      // Gerät/Browser ohne Orientierungssensor
      setCompassPermissionNeeded(false)
      return
    }
    if (DOE?.requestPermission && !compassEnabled) {
      setCompassPermissionNeeded(true)
    } else if (!DOE?.requestPermission) {
      setCompassEnabled(true)
    } else if (compassEnabled) {
      setCompassPermissionNeeded(false)
    }
  }, [compassEnabled])

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

  // Vacations + vehicles
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/vacations')
        const data = (await res.json()) as ApiResponse<Vacation[]>
        if (!cancelled && data.success && data.data) {
          setVacations(data.data)
        }
      } catch {
        // offline: vacations optional
      }
      try {
        const res = await fetch('/api/transport-vehicles')
        const data = (await res.json()) as ApiResponse<{ vehicles?: TransportVehicle[] } | TransportVehicle[]>
        if (!cancelled && data.success && data.data) {
          const list = Array.isArray(data.data)
            ? data.data
            : (data.data.vehicles ?? [])
          setVehicles(list)
          const caravan = list.find(
            (v) =>
              supportsGrundriss(v.fahrzeugtyp) &&
              v.breite_m &&
              resolvePlacementLengthM(v).lengthM
          )
          if (caravan) setSelectedVehicleId((prev) => prev || caravan.id)
        }
      } catch {
        const cached = await getCachedTransportVehicles().catch(() => [])
        if (!cancelled && cached.length) {
          setVehicles(cached)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Default-Urlaub einmalig setzen (aktiv oder nächster)
  // Ohne laufenden Urlaub: Ansicht „Planung“ (sonst „Vor Ort“)
  useEffect(() => {
    if (vacations.length === 0) return
    const today = todayInAppTimezone()
    const hasActive = vacations.some(
      (v) => v.startdatum <= today && v.enddatum >= today
    )

    if (!modeDefaultApplied.current) {
      const explicitMode = searchParams.get('mode')
      const deepStay = searchParams.get('stayId')
      if (explicitMode === 'planung' || deepStay) {
        setMode('planung')
      } else if (explicitMode === 'vor-ort') {
        setMode('vor-ort')
      } else {
        setMode(hasActive ? 'vor-ort' : 'planung')
      }
      modeDefaultApplied.current = true
    }

    if (vacationDefaultApplied.current) return
    if (searchParams.get('stayId')) {
      vacationDefaultApplied.current = true
      return
    }
    if (selectedVacationId) {
      vacationDefaultApplied.current = true
      return
    }
    const id = pickDefaultVacationId(vacations, today)
    if (id) {
      setSelectedVacationId(id)
      vacationDefaultApplied.current = true
    }
  }, [vacations, selectedVacationId, searchParams])

  // Load stays when vacation selected or deep-link stayId
  useEffect(() => {
    if (mode !== 'planung') return
    let cancelled = false
    const deepStayId = searchParams.get('stayId')
    const today = todayInAppTimezone()

    const run = async () => {
      if (selectedVacationId) {
        const res = await fetch(`/api/vacations/${selectedVacationId}`)
        const data = (await res.json()) as ApiResponse<{ stays: VacationCampingStay[] }>
        if (cancelled || !data.success || !data.data) return
        setStays(data.data.stays)
        setSelectedStayId((prev) => {
          const prefer = deepStayId || prev
          if (prefer && data.data!.stays.some((s) => s.id === prefer)) return prefer
          return pickDefaultStayId(data.data!.stays, today)
        })
        return
      }

      if (deepStayId && vacations.length > 0) {
        for (const v of vacations) {
          const res = await fetch(`/api/vacations/${v.id}`)
          const data = (await res.json()) as ApiResponse<{ stays: VacationCampingStay[] }>
          if (!data.success || !data.data) continue
          if (data.data.stays.some((s) => s.id === deepStayId)) {
            if (cancelled) return
            setSelectedVacationId(v.id)
            setStays(data.data.stays)
            setSelectedStayId(deepStayId)
            return
          }
        }
      }
    }

    void run().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [mode, selectedVacationId, vacations, searchParams])

  const selectedStay = useMemo(
    () => stays.find((s) => s.id === selectedStayId) ?? null,
    [stays, selectedStayId]
  )
  const selectedPlatzplanUrl = useMemo(
    () =>
      selectedStay
        ? buildPlatzplanUrl(selectedStay.campingplatz, selectedStay.platznummer)
        : null,
    [selectedStay]
  )

  const selectedVacation = useMemo(
    () => vacations.find((v) => v.id === selectedVacationId) ?? null,
    [vacations, selectedVacationId]
  )

  // Sync pin/heading from stay
  useEffect(() => {
    if (!selectedStay) {
      setPin(null)
      return
    }
    if (
      selectedStay.stellplatz_lat != null &&
      selectedStay.stellplatz_lng != null &&
      Number.isFinite(selectedStay.stellplatz_lat) &&
      Number.isFinite(selectedStay.stellplatz_lng)
    ) {
      setPin({ lat: selectedStay.stellplatz_lat, lng: selectedStay.stellplatz_lng })
    } else {
      setPin(null)
    }
    if (selectedStay.wohnwagen_heading_deg != null) {
      setCaravanHeading(normalizeCaravanHeading(selectedStay.wohnwagen_heading_deg))
    } else {
      setCaravanHeading(0)
    }
    if (selectedStay.start_datum) {
      setPlanDate(selectedStay.start_datum.slice(0, 10))
    }
  }, [selectedStay])

  const planCenter = useMemo(() => {
    if (pin) return pin
    const cp = selectedStay?.campingplatz
    if (cp?.lat != null && cp?.lng != null && Number.isFinite(cp.lat) && Number.isFinite(cp.lng)) {
      return { lat: cp.lat, lng: cp.lng }
    }
    return null
  }, [pin, selectedStay])

  const mapCenter = mode === 'vor-ort' ? position : planCenter

  // Prefetch tiles when planning center known
  useEffect(() => {
    if (!mapCenter || basemap !== 'satellite' || displayMode !== 'karte') return
    void prefetchSatelliteAround(mapCenter.lat, mapCenter.lng).catch(() => {})
  }, [mapCenter?.lat, mapCenter?.lng, basemap, displayMode, mapCenter])

  // Transportmittel des gewählten Urlaubs (für Wohnwagen-Filter)
  useEffect(() => {
    if (!selectedVacationId) {
      setVacationTransportIds(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(
          `/api/vacations/transports?vacationId=${encodeURIComponent(selectedVacationId)}`
        )
        const data = (await res.json()) as ApiResponse<{ transportIds?: string[] }>
        if (cancelled) return
        if (data.success && data.data?.transportIds) {
          setVacationTransportIds(data.data.transportIds)
        } else {
          setVacationTransportIds(null)
        }
      } catch {
        if (!cancelled) setVacationTransportIds(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedVacationId])

  const caravanVehicles = useMemo(() => {
    const all = vehicles.filter((v) => supportsGrundriss(v.fahrzeugtyp))
    if (!vacationTransportIds || vacationTransportIds.length === 0) return all
    const allowed = new Set(vacationTransportIds)
    const forVacation = all.filter((v) => allowed.has(v.id))
    // Fallback: wenn im Urlaub kein Wohnwagen hinterlegt ist, alle anbieten
    return forVacation.length > 0 ? forVacation : all
  }, [vehicles, vacationTransportIds])

  // Genau ein Wohnwagen → automatisch wählen (keine Auswahl-UI nötig)
  useEffect(() => {
    if (caravanVehicles.length === 1) {
      const only = caravanVehicles[0]
      if (only && selectedVehicleId !== only.id) {
        setSelectedVehicleId(only.id)
      }
    }
  }, [caravanVehicles, selectedVehicleId])

  const selectedVehicle = useMemo(
    () => caravanVehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [caravanVehicles, selectedVehicleId]
  )

  const showCaravanSelect =
    displayMode === 'karte' && caravanVehicles.length > 1

  const caravanOverlay = useMemo(() => {
    const place =
      pin ??
      (mode === 'planung' ? planCenter : null) ??
      (mode === 'vor-ort' ? position : null)
    if (!place || !selectedVehicle) return null
    const placeLen = resolvePlacementLengthM(selectedVehicle)
    const lengthM = placeLen.lengthM ?? selectedVehicle.laenge_m
    const outline = resolveCaravanOutline({
      laengeM: lengthM,
      breiteM: selectedVehicle.breite_m,
      grundrissJson: selectedVehicle.grundriss_json,
    })
    if (!outline) return null
    // R2-Key im Query: nach Bildwechsel neuer Key → Browser lädt nicht das gecachte Altbild
    const imageUrl = selectedVehicle.grundriss_bild_r2_key
      ? `/api/transport-vehicles/${encodeURIComponent(selectedVehicle.id)}/grundriss-image?k=${encodeURIComponent(selectedVehicle.grundriss_bild_r2_key)}`
      : null
    return {
      outline,
      headingDeg: caravanHeading,
      center: place,
      lengthM: lengthM ?? null,
      widthM: selectedVehicle.breite_m ?? null,
      imageUrl,
    }
  }, [pin, planCenter, mode, position, selectedVehicle, caravanHeading])

  const saveStellplatz = useCallback(
    async (next: {
      pin?: { lat: number; lng: number } | null
      heading?: number
      clear?: boolean
    }) => {
      if (!selectedStayId) return
      setSavingStellplatz(true)
      try {
        const body: Record<string, unknown> = next.clear ? { clear: true } : {}
        if (!next.clear) {
          if (next.pin !== undefined) {
            body.stellplatz_lat = next.pin?.lat ?? null
            body.stellplatz_lng = next.pin?.lng ?? null
          }
          if (next.heading !== undefined) {
            body.wohnwagen_heading_deg = next.heading
          }
        }
        const res = await fetch(`/api/vacations/stays/${selectedStayId}/stellplatz`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as ApiResponse<unknown>
        if (!data.success) {
          alert(data.error ?? 'Speichern fehlgeschlagen')
          return
        }
        if (next.clear) {
          setPin(null)
        } else if (next.pin !== undefined) {
          setPin(next.pin)
        }
        if (next.heading !== undefined) setCaravanHeading(next.heading)
        setStays((prev) =>
          prev.map((s) => {
            if (s.id !== selectedStayId) return s
            if (next.clear) {
              return {
                ...s,
                stellplatz_lat: null,
                stellplatz_lng: null,
                wohnwagen_heading_deg: null,
              }
            }
            return {
              ...s,
              stellplatz_lat:
                next.pin !== undefined ? (next.pin?.lat ?? null) : s.stellplatz_lat,
              stellplatz_lng:
                next.pin !== undefined ? (next.pin?.lng ?? null) : s.stellplatz_lng,
              wohnwagen_heading_deg:
                next.heading !== undefined ? next.heading : s.wohnwagen_heading_deg,
            }
          })
        )
      } catch {
        alert('Speichern fehlgeschlagen (offline?)')
      } finally {
        setSavingStellplatz(false)
      }
    },
    [selectedStayId]
  )

  const setDisplayModePersisted = (next: SonnenDisplayMode) => {
    setDisplayMode(next)
    writeSonnenDisplayPref(next)
    if (next === 'kompass') setCaravanMoveMode(false)
  }

  const setBasemapPersisted = (next: SonnenBasemap) => {
    setBasemap(next)
    writeSonnenBasemapPref(next)
    if (next === 'osm') setSatelliteHint(null)
  }

  const centerSourceLabel = useMemo(() => {
    if (mode === 'vor-ort') {
      if (position) return 'Live-GPS'
      return 'kein GPS'
    }
    if (pin) return 'Stellplatz-Pin'
    if (planCenter) return 'Campingplatz-Koordinaten'
    return 'keine Koordinaten'
  }, [mode, position, pin, planCenter])

  const planDateObj = useMemo(() => {
    const d = new Date(planDate + 'T12:00:00')
    return Number.isNaN(d.getTime()) ? undefined : d
  }, [planDate])

  const planSummaryLine = useMemo(() => {
    const vac = selectedVacation?.titel ?? 'Urlaub wählen'
    const stayName = selectedStay
      ? `${selectedStay.campingplatz.name}${
          selectedStay.platznummer ? ` · Pl. ${selectedStay.platznummer}` : ''
        }`
      : 'Campingplatz'
    return `${vac} · ${stayName} · ${formatShortDate(planDate)}`
  }, [selectedVacation, selectedStay, planDate])

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div className={cn('flex-1 min-w-0 transition-all duration-300', 'lg:ml-[280px]')}>
        <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-full">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-card shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowNavSidebar(true)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-brand-heading">
                  Sonnen-Ausrichtung
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === 'vor-ort' ? 'default' : 'outline'}
              onClick={() => {
                setMode('vor-ort')
                router.replace('/tools/sonnen-ausrichtung', { scroll: false })
              }}
            >
              Vor Ort
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'planung' ? 'default' : 'outline'}
              onClick={() => setMode('planung')}
            >
              Planung
            </Button>
            <div className="ml-auto flex overflow-hidden rounded-md border border-border">
              <button
                type="button"
                onClick={() => setDisplayModePersisted('karte')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors',
                  displayMode === 'karte'
                    ? 'bg-[rgb(45,79,30)] text-white'
                    : 'bg-background text-foreground hover:bg-muted'
                )}
              >
                <MapIcon className="h-3.5 w-3.5" />
                Karte
              </button>
              <button
                type="button"
                onClick={() => setDisplayModePersisted('kompass')}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-border',
                  displayMode === 'kompass'
                    ? 'bg-[rgb(45,79,30)] text-white'
                    : 'bg-background text-foreground hover:bg-muted'
                )}
              >
                <Compass className="h-3.5 w-3.5" />
                Kompass
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Zentrum: {centerSourceLabel}
            {satelliteHint && displayMode === 'karte' && basemap === 'satellite'
              ? ` · ${satelliteHint}`
              : ''}
          </p>

          {mode === 'planung' && (
            <>
              <button
                type="button"
                onClick={() => setPlanPickerOpen(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Urlaub · Platz · Datum
                  </p>
                  <p className="truncate text-sm font-medium text-foreground">
                    {planSummaryLine}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              <ResponsiveModal
                open={planPickerOpen}
                onOpenChange={setPlanPickerOpen}
                title="Auswahl"
                description="Urlaub, Campingplatz und Datum für die Sonnenvorschau"
              >
                <div className="space-y-4">
                  <div>
                    <Label>Urlaub</Label>
                    <Select
                      value={selectedVacationId || undefined}
                      onValueChange={(v) => {
                        setSelectedVacationId(v)
                        setSelectedStayId('')
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Urlaub wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {vacations.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.titel}
                            <span className="ml-1 text-muted-foreground">
                              ({formatShortDate(v.startdatum)}–{formatShortDate(v.enddatum)})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Campingplatz / Aufenthalt</Label>
                    <Select
                      value={selectedStayId || undefined}
                      onValueChange={setSelectedStayId}
                      disabled={stays.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aufenthalt wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {stays.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.campingplatz.name}
                            {s.platznummer ? ` · Platz ${s.platznummer}` : ''}
                            {s.start_datum
                              ? ` · ${formatShortDate(s.start_datum)}`
                              : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedStay && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2">
                        <div className="min-w-0 flex-1 text-sm">
                          <span className="text-muted-foreground">Gebuchter Platz:</span>{' '}
                          {selectedStay.platznummer?.trim() ? (
                            <strong className="text-foreground">
                              {selectedStay.platznummer.trim()}
                            </strong>
                          ) : (
                            <span className="text-muted-foreground">nicht hinterlegt</span>
                          )}
                          {selectedStay.campingplatz.platzplan_hinweis?.trim() && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                              {selectedStay.campingplatz.platzplan_hinweis.trim()}
                            </p>
                          )}
                        </div>
                        {selectedPlatzplanUrl && (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <a
                              href={selectedPlatzplanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MapIcon className="h-3.5 w-3.5 mr-1" />
                              Platzplan
                              <ExternalLink className="h-3 w-3 ml-1 opacity-70" />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Datum (Sonnenstand)</Label>
                    <CalendarDatePicker value={planDate} onChange={setPlanDate} />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!position || !selectedStayId || savingStellplatz}
                      onClick={() => {
                        if (!position) return
                        void saveStellplatz({ pin: position })
                      }}
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1" />
                      GPS als Stellplatz
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!pin || !selectedStayId || savingStellplatz}
                      onClick={() => void saveStellplatz({ clear: true })}
                    >
                      Pin löschen
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tippe auf die Karte, um den Stellplatz-Pin zu setzen. Wohnwagen per
                    „Verschieben“ ziehen.
                  </p>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => setPlanPickerOpen(false)}
                  >
                    Fertig
                  </Button>
                </div>
              </ResponsiveModal>
            </>
          )}

          {mode === 'vor-ort' && isLoadingGps && (
            <div className="flex items-center gap-2 text-muted-foreground py-2">
              <MapPin className="w-5 h-5 animate-pulse shrink-0" />
              <span>Standort wird ermittelt…</span>
            </div>
          )}

          {mode === 'vor-ort' && gpsError && !position && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
              <p className="font-medium">GPS nicht verfügbar</p>
              <p className="text-sm mt-1">{gpsError}</p>
            </div>
          )}

          {displayMode === 'karte' && (showCaravanSelect || (caravanOverlay && isCoarsePointer)) && (
            <div className="flex flex-wrap items-end gap-2">
              {showCaravanSelect && (
                <div className="min-w-[12rem] flex-1 space-y-1">
                  <Label className="text-xs">Wohnwagen</Label>
                  <Select
                    value={selectedVehicleId || '__none__'}
                    onValueChange={(v) => setSelectedVehicleId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Kein Wohnwagen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Kein Wohnwagen</SelectItem>
                      {caravanVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                          {(() => {
                            const L = resolvePlacementLengthM(v).lengthM
                            return L && v.breite_m
                              ? ` (${L}×${v.breite_m} m)`
                              : ' (ohne Maße)'
                          })()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {caravanOverlay && isCoarsePointer && (
                <Button
                  type="button"
                  size="sm"
                  variant={caravanMoveMode ? 'default' : 'outline'}
                  className="h-9 gap-1.5"
                  onClick={() => setCaravanMoveMode((v) => !v)}
                >
                  <Move className="h-3.5 w-3.5" />
                  {caravanMoveMode ? 'Fertig' : 'Verschieben'}
                </Button>
              )}
            </div>
          )}

          {displayMode === 'karte' &&
            selectedVehicle &&
            !resolveCaravanOutline({
              laengeM: resolvePlacementLengthM(selectedVehicle).lengthM,
              breiteM: selectedVehicle.breite_m,
              grundrissJson: selectedVehicle.grundriss_json,
            }) && (
              <p className="text-sm text-amber-700">
                Keine Maße hinterlegt.{' '}
                <Link href="/transportmittel" className="underline font-medium">
                  Unter Transportmittel Länge/Breite ergänzen
                </Link>
              </p>
            )}

          {mode === 'vor-ort' && compassPermissionNeeded && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-blue-800">
              <p className="font-medium">Kompass aktivieren</p>
              <p className="text-sm mt-1">
                Für die dynamische Ausrichtung wird die absolute Kompass-Orientierung benötigt.
              </p>
              <Button onClick={requestCompassPermission} className="mt-3" size="sm">
                <Compass className="w-4 h-4 mr-2" />
                Kompass aktivieren
              </Button>
            </div>
          )}

          {mapCenter && displayMode === 'karte' && (
            <div className="space-y-3">
              <SonnenAusrichtungMap
                center={mapCenter}
                mode={mode}
                basemap={basemap}
                onBasemapChange={setBasemapPersisted}
                deviceHeading={mode === 'vor-ort' ? smoothedHeading : null}
                date={mode === 'planung' ? planDateObj : undefined}
                pin={pin}
                caravan={caravanOverlay}
                caravanDraggable={!isCoarsePointer || caravanMoveMode}
                lockMapPan={caravanMoveMode}
                heightClassName="h-[420px] md:h-[580px]"
                onCaravanMove={(lat, lng) => {
                  setPin({ lat, lng })
                  if (selectedStayId) {
                    void saveStellplatz({ pin: { lat, lng } })
                  }
                }}
                onMapClick={(lat, lng) => {
                  if (caravanMoveMode) return
                  if (mode !== 'planung' || !selectedStayId) return
                  void saveStellplatz({ pin: { lat, lng } })
                }}
                onSatelliteUnavailable={(reason) => setSatelliteHint(reason)}
                onSatelliteAvailable={() => setSatelliteHint(null)}
              />

              {caravanOverlay && (
                <div className="flex items-center gap-3">
                  <Label className="shrink-0 text-sm">Drehen</Label>
                  <input
                    type="range"
                    min={0}
                    max={359}
                    value={Math.round(caravanHeading)}
                    onChange={(e) => setCaravanHeading(Number(e.target.value))}
                    onMouseUp={() => {
                      if (selectedStayId) void saveStellplatz({ heading: caravanHeading })
                    }}
                    onTouchEnd={() => {
                      if (selectedStayId) void saveStellplatz({ heading: caravanHeading })
                    }}
                    className="flex-1 accent-[rgb(45,79,30)]"
                  />
                  <span className="tabular-nums text-sm w-10 text-right">
                    {Math.round(caravanHeading)}°
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => {
                        const next = normalizeCaravanHeading(caravanHeading - 90)
                        setCaravanHeading(next)
                        if (selectedStayId) void saveStellplatz({ heading: next })
                      }}
                      title="90° nach links"
                      aria-label="90° nach links drehen"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => {
                        const next = normalizeCaravanHeading(caravanHeading + 90)
                        setCaravanHeading(next)
                        if (selectedStayId) void saveStellplatz({ heading: next })
                      }}
                      title="90° nach rechts"
                      aria-label="90° nach rechts drehen"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {caravanOverlay && isCoarsePointer && !caravanMoveMode && (
                <p className="text-xs text-muted-foreground">
                  Am Smartphone: „Verschieben“ tippen, dann den Wohnwagen ziehen — die Karte
                  bleibt dabei fixiert, damit Finger und Karten-Pan sich nicht beißen.
                </p>
              )}
            </div>
          )}

          {mapCenter && displayMode === 'kompass' && (
            <SonnenAusrichtungCompass
              lat={mapCenter.lat}
              lng={mapCenter.lng}
              date={mode === 'planung' ? planDateObj : undefined}
              deviceHeading={mode === 'vor-ort' ? smoothedHeading : null}
            />
          )}

          {mode === 'planung' && !mapCenter && selectedStay && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800 text-sm">
              Für diesen Campingplatz fehlen Koordinaten. Bitte im Campingplatz bearbeiten oder
              einen Stellplatz-Pin setzen (nach GPS vor Ort).
            </div>
          )}

          {mode === 'vor-ort' && gpsError && position && (
            <p className="text-sm text-amber-600">Hinweis: {gpsError}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SonnenAusrichtungPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground">
          Laden…
        </div>
      }
    >
      <SonnenAusrichtungContent />
    </Suspense>
  )
}
