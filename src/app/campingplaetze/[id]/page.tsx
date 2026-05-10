'use client'

import { useAuth } from '@/components/auth-provider'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type TransitionEvent,
} from 'react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Menu,
  MoreVertical,
  Route,
  Globe2,
  PlayCircle,
  Pencil,
  Trash2,
  Star,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
import Image from 'next/image'
import { campingplatzFotoImageSrc } from '@/lib/campingplatz-photo-url'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CampingplatzEditModal } from '@/components/campingplatz-edit-modal'
import { CampingplatzOverviewMap } from '@/components/campingplatz-overview-map'
import {
  getCachedCampingplatz,
  getCachedCampingplatzFotos,
  getCachedRoute,
  getCachedHomeLocation,
} from '@/lib/offline-sync'
import {
  cacheCampingplatz,
  cacheCampingplatzFotos,
  cacheRoute,
  cacheHomeLocation,
} from '@/lib/offline-db'
import { useReconnectRefetch } from '@/hooks/use-reconnect-refetch'

function CampingplatzDetailEditModalGate({
  detailId,
  campingplatz,
  onSaved,
  onRefreshCampingplatz,
}: {
  detailId: string
  campingplatz: Campingplatz | null
  onSaved: (saved: Campingplatz) => void
  onRefreshCampingplatz?: (id: string) => Promise<void>
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const open = searchParams.has('bearbeiten') && campingplatz != null
  return (
    <CampingplatzEditModal
      open={open}
      onOpenChange={(next) => {
        if (!next) router.replace(`/campingplaetze/${detailId}`, { scroll: false })
      }}
      initialCampingplatz={campingplatz}
      onSaved={onSaved}
      onRefreshCampingplatz={onRefreshCampingplatz}
    />
  )
}

export default function CampingplatzDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const router = useRouter()
  const { user, loading, canAccessConfig } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [campingplatz, setCampingplatz] = useState<Campingplatz | null>(null)
  const [fotos, setFotos] = useState<CampingplatzFoto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number
    durationMinutes: number
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campingplatz | null>(null)
  const [archivePrompt, setArchivePrompt] = useState<Campingplatz | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [homeCoordsLoaded, setHomeCoordsLoaded] = useState(false)
  const [lightboxFotoId, setLightboxFotoId] = useState<string | null>(null)
  const lightboxTouchRef = useRef<{ x: number; y: number } | null>(null)
  const lightboxSwipeNavRef = useRef<'next' | 'prev' | null>(null)
  const lightboxGestureModeRef = useRef<'h' | 'v' | null>(null)
  const lightboxDismissFinishingRef = useRef(false)
  const lightboxWasOpenRef = useRef(false)
  const lightboxClosingRef = useRef(false)
  const fotosRef = useRef(fotos)
  const [lightboxImgTxPx, setLightboxImgTxPx] = useState(0)
  const [lightboxImgTxOn, setLightboxImgTxOn] = useState(true)
  /** Nach-unten-Wischen: vertikaler Offset + Verkleinerung (Lightbox schließen) */
  const [lightboxPullDy, setLightboxPullDy] = useState(0)
  const lightboxPullDyRef = useRef(0)

  const lightboxIndex = useMemo(() => {
    if (!lightboxFotoId) return -1
    return fotos.findIndex((f) => f.id === lightboxFotoId)
  }, [lightboxFotoId, fotos])

  const goLightboxPrev = useCallback(() => {
    setLightboxFotoId((id) => {
      if (!id) return null
      const i = fotos.findIndex((f) => f.id === id)
      if (i <= 0) return id
      const prev = fotos[i - 1]
      return prev?.id ?? id
    })
  }, [fotos])

  const goLightboxNext = useCallback(() => {
    setLightboxFotoId((id) => {
      if (!id) return null
      const i = fotos.findIndex((f) => f.id === id)
      if (i < 0 || i >= fotos.length - 1) return id
      const next = fotos[i + 1]
      return next?.id ?? id
    })
  }, [fotos])

  useEffect(() => {
    if (lightboxFotoId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goLightboxPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goLightboxNext()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lightboxFotoId, goLightboxPrev, goLightboxNext])

  useEffect(() => {
    fotosRef.current = fotos
  }, [fotos])

  const closeLightbox = useCallback(() => {
    if (lightboxClosingRef.current || lightboxFotoId == null) return
    if (typeof window !== 'undefined' && (window.history.state as { cpLightbox?: boolean } | null)?.cpLightbox) {
      lightboxClosingRef.current = true
      window.history.back()
    } else {
      setLightboxFotoId(null)
    }
  }, [lightboxFotoId])

  useEffect(() => {
    const onPop = () => {
      lightboxClosingRef.current = false
      setLightboxFotoId((cur) => (cur != null ? null : cur))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const open = lightboxFotoId != null
    if (open && !lightboxWasOpenRef.current) {
      window.history.pushState({ cpLightbox: true }, '', window.location.href)
    }
    lightboxWasOpenRef.current = open
    if (!open) {
      lightboxClosingRef.current = false
      setLightboxImgTxPx(0)
      setLightboxImgTxOn(true)
      lightboxSwipeNavRef.current = null
      lightboxGestureModeRef.current = null
      lightboxDismissFinishingRef.current = false
      lightboxPullDyRef.current = 0
      setLightboxPullDy(0)
    }
  }, [lightboxFotoId])

  const lightboxViewportW = useCallback(
    () => (typeof window !== 'undefined' ? window.innerWidth : 400),
    []
  )

  const applyLightboxEnterFromSide = useCallback((side: 'left' | 'right') => {
    const vw = lightboxViewportW()
    setLightboxImgTxOn(false)
    setLightboxImgTxPx(side === 'right' ? vw : -vw)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLightboxImgTxOn(true)
        setLightboxImgTxPx(0)
      })
    })
  }, [lightboxViewportW])

  const onLightboxTransformTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== 'transform' || e.target !== e.currentTarget) return
      if (lightboxDismissFinishingRef.current) {
        lightboxDismissFinishingRef.current = false
        lightboxPullDyRef.current = 0
        setLightboxPullDy(0)
        closeLightbox()
        return
      }
      const nav = lightboxSwipeNavRef.current
      if (!nav) return
      lightboxSwipeNavRef.current = null
      const list = fotosRef.current
      const curId = lightboxFotoId
      if (!curId) return
      const i = list.findIndex((f) => f.id === curId)
      if (nav === 'next' && i >= 0 && i < list.length - 1) {
        const next = list[i + 1]
        if (next) setLightboxFotoId(next.id)
        applyLightboxEnterFromSide('right')
      } else if (nav === 'prev' && i > 0) {
        const prev = list[i - 1]
        if (prev) setLightboxFotoId(prev.id)
        applyLightboxEnterFromSide('left')
      }
    },
    [lightboxFotoId, applyLightboxEnterFromSide, closeLightbox]
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoadError(null)
    try {
      const res = await fetch(`/api/campingplaetze/${id}`)
      const data = (await res.json()) as ApiResponse<{
        campingplatz: Campingplatz
        fotos: CampingplatzFoto[]
      }>
      if (!data.success || !data.data) {
        // Antwort vom Server ohne Erfolg → ggf. trotzdem Cache anbieten
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const [cp, ft] = await Promise.all([
            getCachedCampingplatz(id),
            getCachedCampingplatzFotos(id),
          ])
          if (cp) {
            setCampingplatz(cp)
            setFotos(ft)
            return
          }
        }
        setLoadError(data.error ?? 'Nicht gefunden')
        setCampingplatz(null)
        setFotos([])
        return
      }
      setCampingplatz(data.data.campingplatz)
      setFotos(data.data.fotos)
      try {
        await cacheCampingplatz(data.data.campingplatz)
        await cacheCampingplatzFotos(id, data.data.fotos)
      } catch (e) {
        console.warn('Cache write failed:', e)
      }
    } catch {
      // Offline-Fallback
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const [cp, ft] = await Promise.all([
          getCachedCampingplatz(id),
          getCachedCampingplatzFotos(id),
        ])
        if (cp) {
          setCampingplatz(cp)
          setFotos(ft)
          return
        }
      }
      setLoadError('Laden fehlgeschlagen')
      setCampingplatz(null)
      setFotos([])
    }
  }, [id])

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  useEffect(() => {
    void load()
  }, [load])

  // Bei Reconnect: Detaildaten erneut vom Server holen
  useReconnectRefetch(load)

  useEffect(() => {
    if (!campingplatz?.id || campingplatz.lat == null || campingplatz.lng == null) {
      setRouteInfo(null)
      return
    }
    if (!user?.id) return
    const userId = user.id
    const cpId = campingplatz.id
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/routes/campingplatz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campingplatzId: cpId }),
        })
        const data = (await res.json()) as {
          success?: boolean
          data?: { distanceKm: number; durationMinutes: number }
        }
        if (!cancelled && data.success && data.data) {
          setRouteInfo({
            distanceKm: data.data.distanceKm,
            durationMinutes: data.data.durationMinutes,
          })
          // Routen-Snapshot pro user|campingplatz cachen
          try {
            await cacheRoute(userId, {
              user_id: userId,
              campingplatz_id: cpId,
              distance_km: data.data.distanceKm,
              duration_min: data.data.durationMinutes,
              provider: 'google',
              updated_at: new Date().toISOString(),
            })
          } catch (cacheErr) {
            console.warn('cacheRoute failed:', cacheErr)
          }
        }
      } catch {
        if (cancelled) return
        // Offline → letzten bekannten Routen-Wert anzeigen
        const cached = await getCachedRoute(userId, cpId)
        if (cached) {
          setRouteInfo({
            distanceKm: cached.distance_km,
            durationMinutes: cached.duration_min,
          })
        } else {
          setRouteInfo(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [campingplatz?.id, campingplatz?.lat, campingplatz?.lng, user?.id])

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

  const openInAdacMaps = async (cp: Campingplatz) => {
    if (cp.lat == null || cp.lng == null) {
      const labelFallback = `${cp.name}, ${cp.ort}, ${cp.land}`
      const urlFallback = `https://maps.adac.de/routenplaner?poi=${encodeURIComponent(labelFallback)}`
      window.open(urlFallback, '_blank')
      return
    }

    let coords = homeCoords
    if (!homeCoordsLoaded) {
      try {
        const res = await fetch('/api/profile/home-location')
        const data = (await res.json()) as ApiResponse<{
          heimat_adresse: string | null
          heimat_lat: number | null
          heimat_lng: number | null
        }>
        if (data.success && data.data) {
          // In IndexedDB spiegeln (auch wenn Lat/Lng fehlen, damit Adresse offline da ist)
          try {
            await cacheHomeLocation({
              heimat_adresse: data.data.heimat_adresse ?? null,
              heimat_lat: data.data.heimat_lat ?? null,
              heimat_lng: data.data.heimat_lng ?? null,
            })
          } catch (cacheErr) {
            console.warn('cacheHomeLocation failed:', cacheErr)
          }
          if (data.data.heimat_lat != null && data.data.heimat_lng != null) {
            coords = { lat: data.data.heimat_lat, lng: data.data.heimat_lng }
            setHomeCoords(coords)
          } else {
            coords = null
          }
        } else {
          coords = null
        }
      } catch {
        // Offline-Fallback
        const cached = await getCachedHomeLocation()
        if (cached?.heimat_lat != null && cached.heimat_lng != null) {
          coords = { lat: cached.heimat_lat, lng: cached.heimat_lng }
          setHomeCoords(coords)
        } else {
          coords = null
        }
      } finally {
        setHomeCoordsLoaded(true)
      }
    }

    if (!coords) {
      const targetOnly = `${cp.lat.toFixed(5)}_${cp.lng.toFixed(5)}_6_0`
      window.open(
        `https://maps.adac.de/route?vehicle-type=trailer&places=${targetOnly}`,
        '_blank'
      )
      return
    }

    const start = `${coords.lat.toFixed(5)}_${coords.lng.toFixed(5)}_1_0`
    const target = `${cp.lat.toFixed(5)}_${cp.lng.toFixed(5)}_6_0`
    window.open(
      `https://maps.adac.de/route?vehicle-type=trailer&places=${start},${target}`,
      '_blank'
    )
  }

  const executeDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteBusy(true)
    try {
      const res = await fetch(`/api/campingplaetze?id=${target.id}`, { method: 'DELETE' })
      if (res.status === 409) {
        const data = (await res.json()) as { requireArchive?: boolean; error?: string }
        if (data.requireArchive) {
          setArchivePrompt(target)
        } else {
          alert(data.error ?? 'Campingplatz kann nicht gelöscht werden.')
        }
      } else {
        const data = (await res.json()) as { success?: boolean; error?: string; archived?: boolean }
        if (!data.success) {
          alert('Fehler beim Löschen: ' + (data.error ?? 'Unbekannt'))
        } else {
          router.push('/campingplaetze')
        }
      }
    } catch {
      alert('Fehler beim Löschen des Campingplatzes.')
    } finally {
      setDeleteBusy(false)
      setDeleteTarget(null)
    }
  }

  const executeArchive = async () => {
    if (!archivePrompt) return
    setDeleteBusy(true)
    try {
      const res = await fetch(
        `/api/campingplaetze?id=${archivePrompt.id}&forceArchive=true`,
        { method: 'DELETE' }
      )
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!data.success) {
        alert('Fehler beim Archivieren: ' + (data.error ?? 'Unbekannt'))
      } else {
        router.push('/campingplaetze')
      }
    } catch {
      alert('Fehler beim Archivieren.')
    } finally {
      setDeleteBusy(false)
      setArchivePrompt(null)
    }
  }

  const attributions = fotos.flatMap((f) => {
    try {
      return f.google_attributions_json ? (JSON.parse(f.google_attributions_json) as string[]) : []
    } catch {
      return []
    }
  })
  const uniqueAttr = [...new Set(attributions.filter(Boolean))]

  const subtitle =
    campingplatz != null
      ? [campingplatz.ort, campingplatz.land].filter(Boolean).join(', ') +
        (campingplatz.bundesland ? ` (${campingplatz.bundesland})` : '')
      : '—'

  if (!id) {
    return null
  }

  const webseiteLink = (() => {
    const raw = campingplatz?.webseite?.trim()
    if (!raw) return null
    const href =
      raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
    const label = raw.replace(/^https?:\/\//i, '')
    return { href, label }
  })()

  const coverBadge = (
    <span
      className="pointer-events-none absolute top-2 left-2 inline-flex h-5 w-5 items-center justify-center rounded bg-[rgb(45,79,30)] text-white shadow-sm"
      aria-label="Standardbild für die Liste"
      title="Standardbild für die Liste"
    >
      <Star className="h-3.5 w-3.5 shrink-0 fill-white stroke-white" strokeWidth={1.25} />
    </span>
  )

  return (
    <div className="min-h-screen flex max-w-full overflow-x-clip">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300',
          'lg:ml-[280px]',
          'max-md:h-dvh max-md:min-h-dvh'
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6 space-y-6 max-w-full">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-scroll-pattern shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
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
                <h1 className="text-xl font-bold text-[rgb(45,79,30)] truncate">
                  {campingplatz?.name ?? 'Campingplatz'}
                </h1>
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              </div>
            </div>
            {canAccessConfig && campingplatz && (
              <DropdownMenu>
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
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() =>
                      router.replace(
                        `/campingplaetze/${encodeURIComponent(id)}?bearbeiten=1`,
                        { scroll: false }
                      )
                    }
                  >
                    <Pencil className="h-4 w-4" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(campingplatz)}
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

          {!campingplatz && !loadError && (
            <div className="flex justify-center py-16 text-muted-foreground">Laden…</div>
          )}

          {campingplatz && (
            <>
              <div className="hidden flex-wrap gap-2 md:flex">
                <Button variant="outline" size="sm" className="bg-white hover:bg-neutral-50" asChild>
                  <Link
                    href="/campingplaetze"
                    className="inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    Zur Liste
                  </Link>
                </Button>
              </div>

              <Card>
                <CardContent className="p-6 space-y-6">
                  {campingplatz.is_archived && (
                    <span className="inline-flex text-xs rounded-full bg-gray-200 text-gray-700 px-2 py-0.5">
                      Archiviert
                    </span>
                  )}

                  {(routeInfo != null || (campingplatz.urlaube_zuordnungen ?? 0) > 0) && (
                    <div className="flex w-full items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-muted-foreground">
                        {routeInfo && (
                          <>
                            <Route className="h-4 w-4 shrink-0 text-[rgb(45,79,30)]" aria-hidden />
                            <span>
                              {Math.round(routeInfo.distanceKm)} km
                              {(() => {
                                const hours = Math.floor(routeInfo.durationMinutes / 60)
                                const minutes = Math.round(routeInfo.durationMinutes % 60)
                                const parts: string[] = []
                                if (hours > 0) parts.push(`${hours} h`)
                                if (minutes > 0 || hours === 0) parts.push(`${minutes} min`)
                                return ` · ${parts.join(' ')}`
                              })()}{' '}
                              von der Heimatadresse
                            </span>
                          </>
                        )}
                      </div>
                      {(campingplatz.urlaube_zuordnungen ?? 0) > 0 && (
                        <Link
                          href={`/urlaube?campingplatz=${encodeURIComponent(campingplatz.id)}`}
                          className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-semibold tabular-nums text-white hover:bg-orange-600"
                          aria-label={`${campingplatz.urlaube_zuordnungen} Urlaube anzeigen`}
                        >
                          {campingplatz.urlaube_zuordnungen}
                        </Link>
                      )}
                    </div>
                  )}

                  <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Fotos</h2>
                    {fotos.length === 0 && !campingplatz.video_link ? (
                      <p className="text-sm text-muted-foreground">Keine Fotos gespeichert.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {fotos.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted text-left outline-none ring-offset-2 transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]"
                            onClick={() => setLightboxFotoId(f.id)}
                          >
                            <Image
                              src={campingplatzFotoImageSrc(f.id, 800)}
                              alt=""
                              width={800}
                              height={600}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                            {f.is_cover && coverBadge}
                          </button>
                        ))}
                        {campingplatz.video_link ? (
                          <a
                            href={campingplatz.video_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-input bg-muted px-2 text-center outline-none ring-offset-2 transition hover:bg-muted/90 hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]"
                          >
                            <PlayCircle
                              className="h-8 w-8 shrink-0 text-[rgb(45,79,30)] sm:h-9 sm:w-9"
                              strokeWidth={1.5}
                              aria-hidden
                            />
                            <span className="text-xs font-medium text-[rgb(45,79,30)]">Video</span>
                          </a>
                        ) : null}
                      </div>
                    )}
                    {uniqueAttr.length > 0 && (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {uniqueAttr.join(' · ')}
                      </p>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Adresse</h2>
                    {webseiteLink && (
                      <div className="flex flex-wrap items-start gap-2 text-sm">
                        <Globe2
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <a
                          href={webseiteLink.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-0 break-all text-[rgb(45,79,30)] underline underline-offset-2 hover:opacity-90"
                          title={webseiteLink.href}
                        >
                          {webseiteLink.label}
                        </a>
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{campingplatz.adresse || '—'}</p>
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-7 gap-1.5 bg-white px-2.5 text-xs hover:bg-neutral-50"
                        onClick={() => void openInAdacMaps(campingplatz)}
                      >
                        <Route className="h-3.5 w-3.5 shrink-0" />
                        Navigation (ADAC)
                      </Button>
                    </div>
                    {campingplatz.lat != null && campingplatz.lng != null && (
                      <div className="space-y-2">
                        <CampingplatzOverviewMap
                          lat={campingplatz.lat}
                          lng={campingplatz.lng}
                          title={campingplatz.name}
                        />
                      </div>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Platz-Typ</h2>
                    <p className="text-sm">{campingplatz.platz_typ}</p>
                  </section>

                  <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Pros</h2>
                      {campingplatz.pros.filter((p) => p.trim()).length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {campingplatz.pros.filter((p) => p.trim()).map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Cons</h2>
                      {campingplatz.cons.filter((c) => c.trim()).length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                      ) : (
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {campingplatz.cons.filter((c) => c.trim()).map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={lightboxFotoId != null} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogContent
          hideCloseButton
          className="fixed left-0 top-0 z-50 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 border-0 bg-transparent p-0 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault()
            closeLightbox()
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Foto Vollansicht</DialogTitle>
          {lightboxFotoId ? (
            <div
              className="flex h-dvh w-screen flex-col"
              style={{
                backgroundColor: `rgba(0,0,0,${Math.max(
                  0.05,
                  0.92 *
                    (1 -
                      Math.min(
                        1,
                        lightboxPullDy /
                          (typeof window !== 'undefined' ? window.innerHeight * 0.68 : 640)
                      ))
                )})`,
              }}
              onClick={closeLightbox}
            >
              <button
                type="button"
                className="absolute right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-md bg-[rgb(45,79,30)] text-white shadow-md outline-none ring-offset-2 ring-offset-black/90 transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/70"
                aria-label="Schließen"
                onClick={(e) => {
                  e.stopPropagation()
                  closeLightbox()
                }}
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </button>
              <div
                className="flex flex-1 flex-col items-center justify-center px-2 pb-6 pt-14"
                onClick={closeLightbox}
              >
                <div
                  className="relative flex max-h-full max-w-full items-center justify-center touch-none"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => {
                    const t = e.touches[0]
                    if (!t) return
                    lightboxTouchRef.current = { x: t.clientX, y: t.clientY }
                    lightboxSwipeNavRef.current = null
                    lightboxGestureModeRef.current = null
                    setLightboxImgTxOn(false)
                  }}
                  onTouchMove={(e) => {
                    const start = lightboxTouchRef.current
                    if (!start) return
                    const t = e.touches[0]
                    if (!t) return
                    const dx = t.clientX - start.x
                    const dy = t.clientY - start.y
                    const lockPx = 12

                    if (!lightboxGestureModeRef.current) {
                      if (Math.hypot(dx, dy) < lockPx) return
                      if (fotos.length < 2) {
                        lightboxGestureModeRef.current =
                          dy > 0 && dy >= Math.abs(dx) * 0.55 ? 'v' : 'h'
                      } else {
                        lightboxGestureModeRef.current =
                          Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
                      }
                    }

                    const mode = lightboxGestureModeRef.current
                    if (mode === 'v') {
                      const pull = Math.max(0, dy)
                      lightboxPullDyRef.current = pull
                      setLightboxPullDy(pull)
                      return
                    }
                    if (mode === 'h' && fotos.length >= 2) {
                      if (Math.abs(dx) < Math.abs(dy) && Math.abs(dy) > 12) return
                      setLightboxImgTxPx(dx)
                    }
                  }}
                  onTouchEnd={(e) => {
                    const start = lightboxTouchRef.current
                    lightboxTouchRef.current = null
                    const mode = lightboxGestureModeRef.current
                    lightboxGestureModeRef.current = null

                    if (mode === 'v') {
                      const vw = lightboxViewportW()
                      const vh = typeof window !== 'undefined' ? window.innerHeight : 640
                      const threshold = Math.min(110, vw * 0.22)
                      const pull = lightboxPullDyRef.current
                      if (pull > threshold) {
                        lightboxDismissFinishingRef.current = true
                        setLightboxImgTxOn(true)
                        lightboxPullDyRef.current = vh * 1.15
                        setLightboxPullDy(vh * 1.15)
                      } else {
                        setLightboxImgTxOn(true)
                        lightboxPullDyRef.current = 0
                        setLightboxPullDy(0)
                      }
                      setLightboxImgTxPx(0)
                      return
                    }

                    if (!start || fotos.length < 2) {
                      setLightboxImgTxOn(true)
                      setLightboxImgTxPx(0)
                      lightboxPullDyRef.current = 0
                      setLightboxPullDy(0)
                      return
                    }
                    const t = e.changedTouches[0]
                    if (!t) {
                      setLightboxImgTxOn(true)
                      setLightboxImgTxPx(0)
                      return
                    }
                    const dx = t.clientX - start.x
                    const dy = t.clientY - start.y
                    const vw = lightboxViewportW()
                    const threshold = Math.min(80, vw * 0.18)
                    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) {
                      setLightboxImgTxOn(true)
                      setLightboxImgTxPx(0)
                      return
                    }
                    if (dx < 0 && lightboxIndex >= 0 && lightboxIndex < fotos.length - 1) {
                      lightboxSwipeNavRef.current = 'next'
                      setLightboxImgTxOn(true)
                      setLightboxImgTxPx(-vw)
                      return
                    }
                    if (dx > 0 && lightboxIndex > 0) {
                      lightboxSwipeNavRef.current = 'prev'
                      setLightboxImgTxOn(true)
                      setLightboxImgTxPx(vw)
                      return
                    }
                    setLightboxImgTxOn(true)
                    setLightboxImgTxPx(0)
                  }}
                >
                  {fotos.length > 1 && (
                    <button
                      type="button"
                      aria-label="Vorheriges Foto"
                      disabled={lightboxIndex <= 0}
                      className="absolute left-1 top-1/2 z-[55] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md outline-none transition-opacity hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-25 md:left-3"
                      onClick={() => goLightboxPrev()}
                    >
                      <ChevronLeft className="h-7 w-7" strokeWidth={2} />
                    </button>
                  )}
                  <div
                    className="max-w-full overflow-visible"
                    style={{
                      transform: `translateX(${lightboxImgTxPx}px) translateY(${lightboxPullDy}px) scale(${Math.max(0.3, 1 - lightboxPullDy / 520)})`,
                      transition: lightboxImgTxOn
                        ? 'transform 0.32s cubic-bezier(0.25, 0.8, 0.25, 1)'
                        : 'none',
                      transformOrigin: 'center center',
                    }}
                    onTransitionEnd={onLightboxTransformTransitionEnd}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Vollbild, dynamische API-URL */}
                    <img
                      src={campingplatzFotoImageSrc(lightboxFotoId, 2400)}
                      alt=""
                      className="max-h-[calc(100dvh-5.5rem)] max-w-full rounded-lg object-contain select-none shadow-2xl"
                      draggable={false}
                    />
                  </div>
                  {fotos.length > 1 && (
                    <button
                      type="button"
                      aria-label="Nächstes Foto"
                      disabled={lightboxIndex < 0 || lightboxIndex >= fotos.length - 1}
                      className="absolute right-1 top-1/2 z-[55] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md outline-none transition-opacity hover:bg-black/55 focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-25 md:right-3"
                      onClick={() => goLightboxNext()}
                    >
                      <ChevronRight className="h-7 w-7" strokeWidth={2} />
                    </button>
                  )}
                  {fotos.length > 1 && lightboxIndex >= 0 && (
                    <p className="pointer-events-none absolute bottom-1 left-1/2 z-[55] -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                      {lightboxIndex + 1} / {fotos.length}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        <CampingplatzDetailEditModalGate
          detailId={id}
          campingplatz={campingplatz}
          onSaved={(saved) => setCampingplatz(saved)}
          onRefreshCampingplatz={async (cid) => {
            if (cid === id) await load()
          }}
        />
      </Suspense>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Campingplatz löschen"
        description="Möchten Sie diesen Campingplatz wirklich löschen? Falls er Urlaubsreisen zugeordnet ist, werden Sie ggf. zum Archivieren aufgefordert."
        onConfirm={executeDelete}
        isLoading={deleteBusy}
      />

      <ConfirmDialog
        open={!!archivePrompt}
        onOpenChange={(open) => {
          if (!open) setArchivePrompt(null)
        }}
        title="Campingplatz archivieren"
        description="Dieser Campingplatz ist bereits Urlaubsreisen zugeordnet. Statt ihn zu löschen, kann er archiviert werden. Möchten Sie ihn archivieren?"
        onConfirm={executeArchive}
        isLoading={deleteBusy}
      />
    </div>
  )
}
