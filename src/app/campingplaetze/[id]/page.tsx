'use client'

import { useAuth } from '@/components/auth-provider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Menu,
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
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'

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
        setLoadError(data.error ?? 'Nicht gefunden')
        setCampingplatz(null)
        setFotos([])
        return
      }
      setCampingplatz(data.data.campingplatz)
      setFotos(data.data.fotos)
    } catch {
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

  useEffect(() => {
    if (!campingplatz?.id || campingplatz.lat == null || campingplatz.lng == null) {
      setRouteInfo(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/routes/campingplatz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campingplatzId: campingplatz.id }),
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
        }
      } catch {
        if (!cancelled) setRouteInfo(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [campingplatz?.id, campingplatz?.lat, campingplatz?.lng])

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
          heimat_lat: number | null
          heimat_lng: number | null
        }>
        if (data.success && data.data && data.data.heimat_lat != null && data.data.heimat_lng != null) {
          coords = { lat: data.data.heimat_lat, lng: data.data.heimat_lng }
          setHomeCoords(coords)
        } else {
          coords = null
        }
      } catch {
        coords = null
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
    <div className="min-h-screen flex bg-background">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300 bg-background',
          'lg:ml-[280px]',
          'max-md:h-dvh max-md:min-h-dvh'
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6 space-y-6">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6 md:pb-4">
            <div className="flex items-center gap-4 min-w-0">
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
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white hover:bg-neutral-50"
                  asChild
                >
                  <Link
                    href="/campingplaetze"
                    className="inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" />
                    Zur Liste
                  </Link>
                </Button>
                {campingplatz.webseite && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-neutral-50"
                    asChild
                  >
                    <a
                      href={campingplatz.webseite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <Globe2 className="h-4 w-4 shrink-0" />
                      Webseite
                    </a>
                  </Button>
                )}
                {campingplatz.video_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-neutral-50"
                    asChild
                  >
                    <a
                      href={campingplatz.video_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <PlayCircle className="h-4 w-4 shrink-0" />
                      Video
                    </a>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-white hover:bg-neutral-50 inline-flex items-center gap-2 whitespace-nowrap"
                  onClick={() => void openInAdacMaps(campingplatz)}
                >
                  <Route className="h-4 w-4 shrink-0" />
                  Navigation (ADAC)
                </Button>
                {canAccessConfig && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-white hover:bg-neutral-50 inline-flex items-center gap-2 whitespace-nowrap"
                      onClick={() =>
                        router.push(`/campingplaetze?bearbeiten=${encodeURIComponent(campingplatz.id)}`)
                      }
                    >
                      <Pencil className="h-4 w-4 shrink-0" />
                      Bearbeiten
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="bg-white hover:bg-neutral-50 text-destructive border-destructive/50 hover:bg-destructive/10 inline-flex items-center gap-2 whitespace-nowrap"
                      onClick={() => setDeleteTarget(campingplatz)}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      Löschen
                    </Button>
                  </>
                )}
              </div>

              <Card>
                <CardContent className="p-6 space-y-6">
                  {campingplatz.is_archived && (
                    <span className="inline-flex text-xs rounded-full bg-gray-200 text-gray-700 px-2 py-0.5">
                      Archiviert
                    </span>
                  )}

                  {routeInfo && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Route className="h-4 w-4 text-[rgb(45,79,30)]" />
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
                    </div>
                  )}

                  <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Fotos</h2>
                    {fotos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Keine Fotos gespeichert.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      </div>
                    )}
                    {uniqueAttr.length > 0 && (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {uniqueAttr.join(' · ')}
                      </p>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Adresse</h2>
                    <p className="text-sm whitespace-pre-wrap">{campingplatz.adresse || '—'}</p>
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

      <Dialog open={lightboxFotoId != null} onOpenChange={(open) => !open && setLightboxFotoId(null)}>
        <DialogContent
          hideCloseButton
          className="fixed left-0 top-0 z-50 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-0 border-0 bg-black/92 p-4 pt-14 shadow-none data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:rounded-none"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">Foto Vollansicht</DialogTitle>
          <DialogClose
            className="absolute right-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-md bg-[rgb(45,79,30)] text-white shadow-md outline-none ring-offset-2 ring-offset-black/90 transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </DialogClose>
          {lightboxFotoId ? (
            <div
              className="relative flex w-full max-w-full flex-1 items-center justify-center"
              onTouchStart={(e) => {
                const t = e.touches[0]
                if (!t) return
                lightboxTouchRef.current = { x: t.clientX, y: t.clientY }
              }}
              onTouchEnd={(e) => {
                const start = lightboxTouchRef.current
                lightboxTouchRef.current = null
                if (!start || fotos.length < 2) return
                const t = e.changedTouches[0]
                if (!t) return
                const dx = t.clientX - start.x
                const dy = t.clientY - start.y
                if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return
                if (dx < 0) goLightboxNext()
                else goLightboxPrev()
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
              {/* eslint-disable-next-line @next/next/no-img-element -- Vollbild, dynamische API-URL */}
              <img
                src={campingplatzFotoImageSrc(lightboxFotoId, 2400)}
                alt=""
                className="max-h-[calc(100dvh-5.5rem)] max-w-full object-contain select-none"
                draggable={false}
              />
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
                <p className="absolute bottom-1 left-1/2 z-[55] -translate-x-1/2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
                  {lightboxIndex + 1} / {fotos.length}
                </p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
