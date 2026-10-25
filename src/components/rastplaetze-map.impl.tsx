'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Rastplatz } from '@/lib/db'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import { openRastplatzInGoogleMaps } from '@/lib/maps-export'
import { ExternalLink, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createMapPinIcon } from '@/lib/map-pin-icon'

const DE_OSM_TILE_URL = 'https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png'
const FALLBACK_OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

function whenContainerReady(el: HTMLElement, onReady: () => void) {
  const run = () => {
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      onReady()
      return true
    }
    return false
  }
  if (run()) return () => {}
  const observer = new ResizeObserver(() => {
    if (run()) observer.disconnect()
  })
  observer.observe(el)
  const timeout = window.setTimeout(() => {
    run()
    observer.disconnect()
  }, 500)
  return () => {
    observer.disconnect()
    window.clearTimeout(timeout)
  }
}

function buildOsmEmbedUrl(
  coords: { lat: number; lng: number }[],
  marker?: { lat: number; lng: number }
): string {
  if (coords.length === 0) return 'https://www.openstreetmap.org/export/embed.html?bbox=5.8%2C47.2%2C15.1%2C55.1&layer=mapnik'
  if (coords.length === 1) {
    const p = coords[0]!
    const pad = 0.08
    const markerParam = marker ?? p
    return `https://www.openstreetmap.org/export/embed.html?bbox=${p.lng - pad}%2C${p.lat - pad}%2C${p.lng + pad}%2C${p.lat + pad}&layer=mapnik&marker=${markerParam.lat}%2C${markerParam.lng}`
  }
  const lats = coords.map((p) => p.lat)
  const lngs = coords.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const padLat = Math.max((maxLat - minLat) * 0.15, 0.05)
  const padLng = Math.max((maxLng - minLng) * 0.15, 0.05)
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng - padLng}%2C${minLat - padLat}%2C${maxLng + padLng}%2C${maxLat + padLat}&layer=mapnik`
}

function RastplaetzeMapFallback({
  points,
  home,
  height,
  className,
  reason,
}: {
  points: Rastplatz[]
  home: RastplaetzeMapHome | null
  height: number
  className?: string
  reason?: string
}) {
  const allCoords = useMemo(() => {
    const list = points.map((p) => ({ lat: p.lat, lng: p.lng }))
    if (home) list.push({ lat: home.lat, lng: home.lng })
    return list
  }, [points, home])

  const embedUrl = buildOsmEmbedUrl(allCoords, home ?? points[0] ?? undefined)
  return (
    <div className={cn('rastplatz-map-root rounded-lg border border-border overflow-hidden bg-muted/30', className)}>
      {reason && (
        <p className="text-xs text-muted-foreground px-3 py-2 border-b bg-muted/50">
          {reason}
        </p>
      )}
      <iframe
        title="Rastplätze auf OpenStreetMap"
        src={embedUrl}
        className="w-full border-0"
        style={{ height: Math.max(height - (reason ? 36 : 0), 160) }}
        loading="lazy"
      />
      <ul className="max-h-32 overflow-y-auto divide-y text-sm">
        {home && points.length === 0 && (
          <li className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="truncate flex-1">{home.label ?? 'Heimatadresse'}</span>
          </li>
        )}
        {points.slice(0, 8).map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-3 py-2">
            <MapPin
              className={cn(
                'h-4 w-4 shrink-0',
                r.bewertung === 'empfehlung' ? 'text-green-700' : 'text-red-600'
              )}
            />
            <span className="truncate flex-1">{r.name}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => openRastplatzInGoogleMaps(r)}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type RastplaetzeMapHome = {
  lat: number
  lng: number
  label?: string
}

export interface RastplaetzeMapProps {
  items: Rastplatz[]
  /** Fallback-Zentrum, wenn noch keine Rastplätze mit Koordinaten existieren */
  home?: RastplaetzeMapHome | null
  className?: string
  height?: number
}

export function RastplaetzeMap({ items, home = null, className, height = 280 }: RastplaetzeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState<string | undefined>()

  const points = useMemo(
    () => items.filter((r) => !r.is_archived && r.lat != null && r.lng != null),
    [items]
  )

  const hasMapContent = points.length > 0 || home != null

  const mapKey = useMemo(() => {
    const p = points.map((x) => x.id).join(',')
    const h = home ? `${home.lat},${home.lng}` : ''
    return `${p}|${h}`
  }, [points, home])

  const allCoords = useMemo(() => {
    const list: [number, number][] = points.map((p) => [p.lat, p.lng])
    if (home) list.push([home.lat, home.lng])
    return list
  }, [points, home])

  useEffect(() => {
    setUseFallback(false)
    setFallbackReason(undefined)
  }, [mapKey])

  useEffect(() => {
    if (!hasMapContent || useFallback) return

    const el = containerRef.current
    if (!el) return

    let disposed = false
    let tileErrors = 0
    let tileLoads = 0
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    const switchToFallback = (reason: string) => {
      if (disposed || useFallback) return
      setFallbackReason(reason)
      setUseFallback(true)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }

    const cleanupReady = whenContainerReady(el, () => {
      if (disposed || mapRef.current) return

      try {
        const map = L.map(el, { zoomControl: true })
        const attachLayer = (url: string, isFallback = false) => {
          const layer = L.tileLayer(url, {
            attribution: '&copy; OpenStreetMap',
            subdomains: 'abc',
            maxZoom: 19,
          })
          layer.on('tileload', () => {
            tileLoads += 1
          })
          layer.on('tileerror', () => {
            tileErrors += 1
            if (!isFallback && tileErrors >= 3) {
              map.removeLayer(layer)
              attachLayer(FALLBACK_OSM_TILE_URL, true)
            }
          })
          layer.addTo(map)
          return layer
        }

        attachLayer(DE_OSM_TILE_URL)
        map.getContainer().classList.add('rastplatz-leaflet-map')
        mapRef.current = map

        fallbackTimer = setTimeout(() => {
          if (tileLoads === 0 && tileErrors > 0) {
            switchToFallback(
              'Kartenkacheln nicht geladen (z. B. localhost). OpenStreetMap-Einbettung als Fallback.'
            )
          }
        }, 4000)

        setTimeout(() => map.invalidateSize(), 100)
      } catch {
        switchToFallback('Interaktive Karte konnte nicht initialisiert werden.')
      }
    })

    return () => {
      disposed = true
      cleanupReady()
      if (fallbackTimer) clearTimeout(fallbackTimer)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [hasMapContent, useFallback])

  useEffect(() => {
    const map = mapRef.current
    if (!map || useFallback) return

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer)
    })

    if (home) {
      L.marker([home.lat, home.lng], {
        icon: createMapPinIcon({ color: 'brand-orange', symbol: 'home' }),
      })
        .addTo(map)
        .bindPopup(`<strong>${home.label ?? 'Heimatadresse'}</strong>`)
    }

    for (const r of points) {
      const icon =
        r.bewertung === 'empfehlung'
          ? createMapPinIcon({ color: 'accent', symbol: 'thumbsUp' })
          : createMapPinIcon({ color: 'destructive', symbol: 'thumbsDown' })
      L.marker([r.lat, r.lng], { icon })
        .addTo(map)
        .bindPopup(
          `<strong>${r.name}</strong><br/>${r.bewertung === 'empfehlung' ? 'Empfehlung' : 'No-Go'}`
        )
    }

    if (allCoords.length === 1) {
      const [lat, lng] = allCoords[0]!
      map.setView([lat, lng], 11)
    } else if (allCoords.length > 1) {
      const bounds = L.latLngBounds(allCoords)
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 })
    }

    setTimeout(() => map.invalidateSize(), 150)
  }, [points, home, allCoords, useFallback])

  if (!hasMapContent) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground border border-border px-4 text-center',
          className
        )}
        style={{ height }}
      >
        Keine Koordinaten für Karte. Bitte Heimatadresse im Profil hinterlegen oder Rastplätze mit
        Adresse anlegen.
      </div>
    )
  }

  if (useFallback) {
    return (
      <RastplaetzeMapFallback
        points={points}
        home={home}
        height={height}
        className={className}
        reason={fallbackReason}
      />
    )
  }

  return (
    <div className={cn('rastplatz-map-root', className)} style={{ height, width: '100%' }}>
      <div
        ref={containerRef}
        className="h-full w-full rounded-lg border border-border bg-muted/20"
      />
    </div>
  )
}
