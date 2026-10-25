'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { cn } from '@/lib/utils'
import {
  createMapPinIcon,
  MAP_PIN_HEIGHT,
  MAP_PIN_WIDTH,
  type MapPinColor,
  type MapPinSymbol,
} from '@/lib/map-pin-icon'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DE_OSM_TILE_URL = 'https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png'
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://www.openstreetmap.de/faq.html">FOSSGIS</a>'

type MapPoint = {
  id: string
  lat: number
  lng: number
  label: string
  kind: 'home' | 'camping' | 'rast'
  bewertung?: 'empfehlung' | 'no_go'
}

type FitOptions = {
  /** Zusätzlicher Pixelrand über das für die Pin-Größe nötige Minimum hinaus. */
  edgePad: number
  maxZoom: number
}

/** Zusätzlicher Kontext unterhalb des untersten Pins (Anker = Spitze unten). */
const PIN_BOTTOM_CONTEXT = 24

/** Korrigiert vertauschte lat/lng (lat muss in [-90, 90] liegen). */
function normalizeCoords(lat: number, lng: number): { lat: number; lng: number } {
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    return { lat: lng, lng: lat }
  }
  return { lat, lng }
}

function pinStyleForPoint(p: MapPoint): { color: MapPinColor; symbol: MapPinSymbol } {
  if (p.kind === 'home') return { color: 'brand-orange', symbol: 'home' }
  if (p.kind === 'camping') return { color: 'primary', symbol: 'camping' }
  if (p.bewertung === 'no_go') return { color: 'destructive', symbol: 'thumbsDown' }
  return { color: 'accent', symbol: 'thumbsUp' }
}

function addGermanTileLayer(map: L.Map) {
  return L.tileLayer(DE_OSM_TILE_URL, {
    attribution: MAP_ATTRIBUTION,
    subdomains: 'abc',
    maxZoom: 19,
  }).addTo(map)
}

function fitMapToPoints(map: L.Map, points: MapPoint[], options: FitOptions) {
  if (points.length === 0) return

  map.invalidateSize({ animate: false })

  if (points.length === 1) {
    const only = points[0]!
    map.setView([only.lat, only.lng], Math.min(11, options.maxZoom), { animate: false })
    return
  }

  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
  // Knappes, asymmetrisches Padding: nur so viel Rand, dass die Pins nicht abgeschnitten
  // werden (Anker unten → Korpus ragt nach oben, halbe Breite zu den Seiten). So füllen
  // die Markierungen den Ausschnitt möglichst aus und liegen eher am Rand statt mittig.
  const padX = Math.round(MAP_PIN_WIDTH / 2) + options.edgePad
  map.fitBounds(bounds, {
    paddingTopLeft: [padX, MAP_PIN_HEIGHT + options.edgePad],
    paddingBottomRight: [padX, options.edgePad + PIN_BOTTOM_CONTEXT],
    maxZoom: options.maxZoom,
    animate: false,
  })
}

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

function UrlaubLeafletMap({
  points,
  interactive,
  className,
  mapKey,
}: {
  points: MapPoint[]
  interactive: boolean
  className?: string
  mapKey: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || points.length === 0) return

    let disposed = false
    let cleanupReady = () => {}
    let refitTimers: (() => void) | null = null

    const fitOptions: FitOptions = interactive
      ? { edgePad: 24, maxZoom: 14 }
      : { edgePad: 18, maxZoom: 13 }

    const scheduleRefit = (map: L.Map) => {
      refitTimers?.()
      const refit = () => {
        if (!mapRef.current || disposed) return
        fitMapToPoints(mapRef.current, points, fitOptions)
      }
      refit()
      const t1 = requestAnimationFrame(refit)
      const t2 = window.setTimeout(refit, 150)
      const t3 = window.setTimeout(refit, interactive ? 450 : 320)
      refitTimers = () => {
        cancelAnimationFrame(t1)
        window.clearTimeout(t2)
        window.clearTimeout(t3)
      }
    }

    const initMap = () => {
      if (disposed || !containerRef.current) return

      refitTimers?.()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const map = L.map(containerRef.current, {
        zoomControl: interactive,
        attributionControl: true,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        scrollWheelZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      })
      map.getContainer().classList.add('urlaub-leaflet-map')

      map.attributionControl?.setPrefix('')

      addGermanTileLayer(map)

      for (const p of points) {
        L.marker([p.lat, p.lng], {
          icon: createMapPinIcon(pinStyleForPoint(p)),
          title: p.label,
          zIndexOffset: p.kind === 'rast' ? 100 : p.kind === 'home' ? 200 : 150,
        }).addTo(map)
      }

      scheduleRefit(map)

      if (!interactive) {
        map.dragging.disable()
        map.touchZoom.disable()
        map.doubleClickZoom.disable()
        map.scrollWheelZoom.disable()
        map.boxZoom.disable()
        map.keyboard.disable()
      }

      mapRef.current = map
    }

    cleanupReady = whenContainerReady(el, initMap)

    return () => {
      disposed = true
      cleanupReady()
      refitTimers?.()
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [points, interactive, mapKey])

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full min-h-[160px] bg-muted', className)}
    />
  )
}

function MapPreviewFrame({
  points,
  onOpenInteractive,
  previewLabel,
  hidden,
}: {
  points: MapPoint[]
  onOpenInteractive: () => void
  previewLabel: string
  hidden?: boolean
}) {
  const pointsKey = points.map((p) => p.id).join('-')

  return (
    <div className="urlaub-map-root w-full max-md:-mx-4 max-md:w-[calc(100%+2rem)] md:mx-0 md:w-full">
      <div
        className={cn(
          'map-embed relative z-0 block w-full overflow-hidden border border-subtle bg-muted shadow-sm',
          'aspect-[2/1] max-md:rounded-none md:aspect-[3/1] md:rounded-xl',
          hidden && 'invisible'
        )}
      >
        <UrlaubLeafletMap
          key={`preview-${pointsKey}`}
          mapKey={`preview-${pointsKey}`}
          points={points}
          interactive={false}
          className="absolute inset-0"
        />
        <button
          type="button"
          onClick={onOpenInteractive}
          className={cn(
            'absolute inset-0 z-10 cursor-pointer border-0 bg-transparent p-0 text-left outline-none',
            'transition-opacity hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
          aria-label={previewLabel}
        >
          <span
            className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white opacity-95 md:text-xs"
            aria-hidden
          >
            Antippen · interaktiv
          </span>
        </button>
      </div>
    </div>
  )
}

export type UrlaubOverviewMapRastplatz = {
  id: string
  lat: number
  lng: number
  name: string
  bewertung: 'empfehlung' | 'no_go'
}

export type UrlaubOverviewMapProps = {
  home: { lat: number; lng: number; label?: string } | null
  campingplaetze: { id: string; lat: number; lng: number; name: string }[]
  rastplaetze?: UrlaubOverviewMapRastplatz[]
  title?: string
}

export function UrlaubOverviewMap({ home, campingplaetze, rastplaetze = [], title }: UrlaubOverviewMapProps) {
  const [interactiveOpen, setInteractiveOpen] = useState(false)

  const points: MapPoint[] = useMemo(() => {
    const list: MapPoint[] = []
    if (home) {
      const { lat, lng } = normalizeCoords(home.lat, home.lng)
      list.push({
        id: 'home',
        lat,
        lng,
        label: home.label ?? 'Heimatadresse',
        kind: 'home',
      })
    }
    for (const cp of campingplaetze) {
      const { lat, lng } = normalizeCoords(cp.lat, cp.lng)
      list.push({
        id: cp.id,
        lat,
        lng,
        label: cp.name,
        kind: 'camping',
      })
    }
    for (const r of rastplaetze) {
      const { lat, lng } = normalizeCoords(r.lat, r.lng)
      list.push({
        id: `rast-${r.id}`,
        lat,
        lng,
        label: r.name,
        kind: 'rast',
        bewertung: r.bewertung,
      })
    }
    return list
  }, [home, campingplaetze, rastplaetze])

  if (points.length === 0) {
    return null
  }

  const previewLabel = title
    ? `Interaktive Karte zu „${title}“ öffnen`
    : 'Interaktive Karte öffnen'
  const modalTitle = title ? `Route: ${title}` : 'Interaktive Karte'

  const pointsKey = points.map((p) => p.id).join('-')

  return (
    <>
      <MapPreviewFrame
        points={points}
        onOpenInteractive={() => setInteractiveOpen(true)}
        previewLabel={previewLabel}
        hidden={interactiveOpen}
      />

      <ResponsiveModal
        open={interactiveOpen}
        onOpenChange={setInteractiveOpen}
        title={modalTitle}
        customContent
        contentClassName={cn(
          // Feste Höhe nötig: Sonst kollabiert flex-1 beim Kartenbereich (Leaflet nur absolute → ~0px).
          'flex h-[min(90dvh,760px)] min-h-0 w-full max-w-none flex-col gap-3 overflow-hidden p-4 sm:w-[min(96vw,920px)] sm:p-5'
        )}
      >
        <h2 className="shrink-0 pr-8 text-base font-semibold text-brand-heading">{modalTitle}</h2>
        <p className="sr-only">
          Verschiebbare OpenStreetMap-Karte mit Zoom und Markierungen für Heimatadresse, Campingplätze
          und Rastplätze entlang aufgeklappter Streckenabschnitte.
        </p>
        {interactiveOpen ? (
          <div
            data-vaul-no-drag=""
            className="map-embed relative min-h-0 flex-1 overflow-hidden rounded-lg border border-subtle bg-muted"
          >
            <UrlaubLeafletMap
              key={`dialog-${pointsKey}`}
              mapKey={`dialog-${pointsKey}`}
              points={points}
              interactive
              className="absolute inset-0 z-0"
            />
          </div>
        ) : null}
      </ResponsiveModal>
    </>
  )
}
