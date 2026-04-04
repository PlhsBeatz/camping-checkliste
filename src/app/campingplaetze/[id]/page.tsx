'use client'

import { useAuth } from '@/components/auth-provider'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NavigationSidebar } from '@/components/navigation-sidebar'
import { ArrowLeft, Menu, Route, Star, Trash2, Upload, Globe2, PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiResponse } from '@/lib/api-types'
import { Campingplatz, type CampingplatzFoto } from '@/lib/db'
import Image from 'next/image'
import { campingplatzFotoImageSrc } from '@/lib/campingplatz-photo-url'

export default function CampingplatzDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const router = useRouter()
  const { user, loading, canAccessConfig } = useAuth()
  const [showNavSidebar, setShowNavSidebar] = useState(false)
  const [campingplatz, setCampingplatz] = useState<Campingplatz | null>(null)
  const [fotos, setFotos] = useState<CampingplatzFoto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fotoBusy, setFotoBusy] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number
    durationMinutes: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const setCoverFoto = async (fotoId: string) => {
    if (!id) return
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/campingplaetze/${id}/fotos/${fotoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setCover: true }),
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!data.success) {
        alert(data.error ?? 'Standardbild konnte nicht gesetzt werden')
        return
      }
      await load()
    } finally {
      setFotoBusy(false)
    }
  }

  const deleteSavedFoto = async (fotoId: string) => {
    if (!id) return
    setFotoBusy(true)
    try {
      const res = await fetch(`/api/campingplaetze/${id}/fotos/${fotoId}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as ApiResponse<unknown>
      if (!data.success) {
        alert(data.error ?? 'Foto konnte nicht gelöscht werden')
        return
      }
      await load()
    } finally {
      setFotoBusy(false)
    }
  }

  const onPickUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !canAccessConfig) return
    const list = e.target.files
    if (!list?.length) return
    setFotoBusy(true)
    try {
      let first = fotos.length === 0
      for (let i = 0; i < list.length; i++) {
        const file = list.item(i)
        if (!file) continue
        const fd = new FormData()
        fd.append('file', file)
        fd.append('setAsCover', first ? 'true' : 'false')
        first = false
        const res = await fetch(`/api/campingplaetze/${id}/fotos`, { method: 'POST', body: fd })
        const data = (await res.json()) as ApiResponse<CampingplatzFoto>
        if (!data.success) {
          alert(data.error ?? 'Upload fehlgeschlagen')
          break
        }
      }
      await load()
    } finally {
      setFotoBusy(false)
      e.target.value = ''
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

  if (!id) {
    return null
  }

  return (
    <div className="min-h-screen flex">
      <NavigationSidebar isOpen={showNavSidebar} onClose={() => setShowNavSidebar(false)} />

      <div
        className={cn(
          'flex-1 flex flex-col min-h-0 min-w-0 transition-all duration-300',
          'lg:ml-[280px]',
          'max-md:h-dvh max-md:min-h-dvh'
        )}
      >
        <div className="flex flex-col flex-1 min-h-0 min-w-0 container mx-auto p-4 md:p-6">
          <div className="sticky top-0 z-10 flex-shrink-0 flex items-center gap-3 bg-white shadow pb-4 -mx-4 px-4 -mt-4 pt-4 md:-mx-6 md:px-6 md:-mt-6 md:pt-6">
            <Button variant="outline" size="icon" onClick={() => setShowNavSidebar(true)} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/campingplaetze" className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                Zur Liste
              </Link>
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-6">
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
                <div>
                  <h1 className="text-xl font-bold text-[rgb(45,79,30)]">{campingplatz.name}</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {campingplatz.ort}, {campingplatz.land}
                    {campingplatz.bundesland && ` (${campingplatz.bundesland})`}
                  </p>
                  {campingplatz.is_archived && (
                    <span className="inline-block mt-2 text-xs rounded-full bg-gray-200 text-gray-700 px-2 py-0.5">
                      Archiviert
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
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
                </div>

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
                  {canAccessConfig && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={onPickUploadFiles}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={fotoBusy}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Foto hochladen
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Google-Fotos können Sie im Bearbeiten-Dialog der Liste hinzufügen.
                      </p>
                    </div>
                  )}
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
                          {canAccessConfig && (
                            <div className="absolute inset-x-0 bottom-0 flex gap-1 p-2 bg-black/50 justify-center">
                              <Button
                                type="button"
                                size="icon"
                                variant={f.is_cover ? 'default' : 'secondary'}
                                className="h-8 w-8"
                                disabled={fotoBusy || f.is_cover}
                                onClick={() => void setCoverFoto(f.id)}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="h-8 w-8"
                                disabled={fotoBusy}
                                onClick={() => void deleteSavedFoto(f.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                  <p className="text-sm whitespace-pre-wrap">
                    {campingplatz.adresse || '—'}
                  </p>
                  {campingplatz.lat != null && campingplatz.lng != null && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {campingplatz.lat.toFixed(5)}, {campingplatz.lng.toFixed(5)}
                    </p>
                  )}
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
    </div>
  )
}
