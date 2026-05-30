'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CAMPING_GREEN = 'rgb(45, 79, 30)'
const HOME_ORANGE = '#f97316'
const DE_OSM_TILE_URL = 'https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png'
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://www.openstreetmap.de/faq.html">FOSSGIS</a>'

type MapPoint = {
  id: string
  lat: number
  lng: number
  label: string
  kind: 'home' | 'camping'
}

type FitOptions = {
  paddingPx: number
  maxZoom: number
  /** Zusätzlicher geographischer Rand um alle Markierungen (Anteil der Spanne). */
  boundsPad: number
}

/** Korrigiert vertauschte lat/lng (lat muss in [-90, 90] liegen). */
function normalizeCoords(lat: number, lng: number): { lat: number; lng: number } {
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    return { lat: lng, lng: lat }
  }
  return { lat, lng }
}

function pinIconSvg(kind: 'home' | 'camping') {
  const fill = kind === 'home' ? HOME_ORANGE : CAMPING_GREEN
  const icon =
    kind === 'home'
      ? `<path d="M16 11.2 11.2 15v5.3H13V18h6v2.3h1.8V15L16 11.2Z" fill="${fill}"/>`
      : `<path d="M11.2 19.8 16 12.5l4.8 7.3H13.8V22h4.4v-2.2H11.2Z" fill="${fill}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))">
    <path d="M16 40C16 40 1.8 21.6 1.8 13.6A14.2 14.2 0 1 1 30.2 13.6C30.2 21.6 16 40 16 40Z" fill="${fill}" stroke="white" stroke-width="1.5"/>
    <circle cx="16" cy="13.6" r="8.2" fill="white"/>
    ${icon}
  </svg>`
}

function createPinIcon(kind: 'home' | 'camping') {
  return L.divIcon({
    html: `<div style="width:32px;height:40px;line-height:0">${pinIconSvg(kind)}</div>`,
    className: 'urlaub-leaflet-pin',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -38],
  })
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
  map.fitBounds(bounds.pad(options.boundsPad), {
    padding: [options.paddingPx, options.paddingPx],
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

const HISTORY_MAP_OVERLAY = 'urlaubLageKarte'

function useMobileMapHistorySync(open: boolean, setOpen: (open: boolean) => void) {
  const closedByPopStateRef = useRef(false)

  useEffect(() => {
    if (!open) return
    const mobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    if (!mobile) return

    window.history.pushState({ [HISTORY_MAP_OVERLAY]: true }, '')

    const onPopState = () => {
      closedByPopStateRef.current = true
      setOpen(false)
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      if (!closedByPopStateRef.current) {
        window.history.back()
      }
      closedByPopStateRef.current = false
    }
  }, [open, setOpen])
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
      ? { paddingPx: 48, maxZoom: 14, boundsPad: 0.1 }
      : { paddingPx: 40, maxZoom: 12, boundsPad: 0.12 }

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
          icon: createPinIcon(p.kind),
          title: p.label,
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
          'relative z-0 block w-full overflow-hidden border border-border bg-muted shadow-sm',
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
            'transition-opacity hover:bg-black/[0.03] focus-visible:ring-2 focus-visible:ring-[rgb(45,79,30)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
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

export type UrlaubOverviewMapProps = {
  home: { lat: number; lng: number; label?: string } | null
  campingplaetze: { id: string; lat: number; lng: number; name: string }[]
  title?: string
}

export function UrlaubOverviewMap({ home, campingplaetze, title }: UrlaubOverviewMapProps) {
  const [interactiveOpen, setInteractiveOpen] = useState(false)
  useMobileMapHistorySync(interactiveOpen, setInteractiveOpen)

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
    return list
  }, [home, campingplaetze])

  if (points.length === 0) {
    return null
  }

  const previewLabel = title
    ? `Interaktive Karte zu „${title}“ öffnen`
    : 'Interaktive Karte öffnen'

  const pointsKey = points.map((p) => p.id).join('-')

  return (
    <>
      <MapPreviewFrame
        points={points}
        onOpenInteractive={() => setInteractiveOpen(true)}
        previewLabel={previewLabel}
        hidden={interactiveOpen}
      />

      <Dialog open={interactiveOpen} onOpenChange={setInteractiveOpen}>
        <DialogContent className="flex h-[min(90dvh,760px)] min-h-0 w-[min(96vw,920px)] max-w-none flex-col gap-3 overflow-hidden p-4 sm:p-5">
          <DialogTitle className="pr-8 text-base font-semibold text-[rgb(45,79,30)]">
            {title ? `Route: ${title}` : 'Interaktive Karte'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Verschiebbare OpenStreetMap-Karte mit Zoom und Markierungen für Heimatadresse
            und Campingplätze.
          </DialogDescription>
          {interactiveOpen ? (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted">
              <UrlaubLeafletMap
                key={`dialog-${pointsKey}`}
                mapKey={`dialog-${pointsKey}`}
                points={points}
                interactive
                className="absolute inset-0 z-0"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
