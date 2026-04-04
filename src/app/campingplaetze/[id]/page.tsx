'use client'

import { useAuth } from '@/components/auth-provider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import {
  ArrowLeft,
  Menu,
  Route,
  Globe2,
  PlayCircle,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
import Image from 'next/image'
import { campingplatzFotoImageSrc } from '@/lib/campingplatz-photo-url'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

  return (
    <div className="min-h-screen flex bg-white">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300 bg-white',
          'lg:ml-[280px]',
          'max-md:h-dvh max-md:min-h-dvh'
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6 space-y-6 bg-white">
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

          <div className="flex-1 min-h-0 space-y-6">
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
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/campingplaetze" className="gap-1">
                      <ArrowLeft className="h-4 w-4" />
                      Zur Liste
                    </Link>
                  </Button>
                  {campingplatz.webseite && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={campingplatz.webseite} target="_blank" rel="noopener noreferrer">
                        <Globe2 className="h-4 w-4 mr-2" />
                        Webseite
                      </a>
                    </Button>
                  )}
                  {campingplatz.video_link && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={campingplatz.video_link} target="_blank" rel="noopener noreferrer">
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Video
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void openInAdacMaps(campingplatz)}
                  >
                    <Route className="h-4 w-4 mr-2" />
                    Navigation (ADAC)
                  </Button>
                  {canAccessConfig && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/campingplaetze?bearbeiten=${encodeURIComponent(campingplatz.id)}`)
                        }
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(campingplatz)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </Button>
                    </>
                  )}
                </div>

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
                        <div key={f.id} className="relative rounded-xl border overflow-hidden bg-muted aspect-[4/3]">
                          <Image
                            src={campingplatzFotoImageSrc(f.id, 800)}
                            alt=""
                            width={800}
                            height={600}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                          {f.is_cover && (
                            <span className="absolute top-2 left-2 text-[10px] bg-[rgb(45,79,30)] text-white px-2 py-0.5 rounded">
                              Standard (Liste)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {uniqueAttr.length > 0 && (
                    <p className="text-[11px] text-muted-foreground leading-snug">{uniqueAttr.join(' · ')}</p>
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

                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-[rgb(45,79,30)]">Pros</h2>
                    {campingplatz.pros.filter((p) => p.trim()).length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <ul className="text-sm list-disc pl-5 space-y-1">
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
                      <ul className="text-sm list-disc pl-5 space-y-1">
                        {campingplatz.cons.filter((c) => c.trim()).map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>

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
