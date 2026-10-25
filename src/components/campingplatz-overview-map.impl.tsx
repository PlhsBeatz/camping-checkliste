'use client'

import { useEffect, useRef, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { cn } from '@/lib/utils'
import { createMapPinIcon } from '@/lib/map-pin-icon'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DE_OSM_TILE_URL = 'https://{s}.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png'
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://www.openstreetmap.de/faq.html">FOSSGIS</a>'

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

function CampingplatzLeafletMap({
  lat,
  lng,
  label,
  interactive,
  className,
  mapKey,
}: {
  lat: number
  lng: number
  label: string
  interactive: boolean
  className?: string
  mapKey: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let disposed = false
    let cleanupReady = () => {}

    const initMap = () => {
      if (disposed || !containerRef.current) return

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
      map.getContainer().classList.add('campingplatz-leaflet-map')
      map.attributionControl?.setPrefix('')

      L.tileLayer(DE_OSM_TILE_URL, {
        attribution: MAP_ATTRIBUTION,
        subdomains: 'abc',
        maxZoom: 19,
      }).addTo(map)

      L.marker([lat, lng], {
        icon: createMapPinIcon({ color: 'primary', symbol: 'camping' }),
        title: label,
      }).addTo(map)

      map.setView([lat, lng], interactive ? 12 : 11, { animate: false })

      const refit = () => {
        if (!mapRef.current || disposed) return
        mapRef.current.invalidateSize({ animate: false })
        mapRef.current.setView([lat, lng], interactive ? 12 : 11, { animate: false })
      }
      requestAnimationFrame(refit)
      window.setTimeout(refit, 150)

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
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [lat, lng, label, interactive, mapKey])

  return (
    <div
      ref={containerRef}
      className={cn('h-full w-full min-h-[160px] bg-muted', className)}
    />
  )
}

export type CampingplatzOverviewMapProps = {
  lat: number
  lng: number
  title?: string
}

export function CampingplatzOverviewMap({ lat, lng, title }: CampingplatzOverviewMapProps) {
  const [interactiveOpen, setInteractiveOpen] = useState(false)

  const previewLabel = title ? `Interaktive Karte zu „${title}“ öffnen` : 'Interaktive Karte öffnen'
  const modalTitle = title ? `Lage: ${title}` : 'Interaktive Karte'
  const pinLabel = title ?? 'Campingplatz'
  const pointsKey = `${lat},${lng}`

  return (
    <>
      <div className="campingplatz-map-root w-full max-md:-mx-4 max-md:w-[calc(100%+2rem)] md:mx-0 md:w-full">
        <div
          className={cn(
            'map-embed relative z-0 block w-full overflow-hidden border border-subtle bg-muted shadow-sm',
            'aspect-[2/1] max-md:rounded-none md:aspect-[3/1] md:rounded-xl',
            interactiveOpen && 'invisible'
          )}
        >
          <CampingplatzLeafletMap
            key={`preview-${pointsKey}`}
            mapKey={`preview-${pointsKey}`}
            lat={lat}
            lng={lng}
            label={pinLabel}
            interactive={false}
            className="absolute inset-0"
          />
          <button
            type="button"
            onClick={() => setInteractiveOpen(true)}
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

      <ResponsiveModal
        open={interactiveOpen}
        onOpenChange={setInteractiveOpen}
        title={modalTitle}
        customContent
        contentClassName={cn(
          'flex h-[min(90dvh,760px)] min-h-0 w-full max-w-none flex-col gap-3 overflow-hidden p-4 sm:w-[min(96vw,920px)] sm:p-5'
        )}
      >
        <h2 className="shrink-0 pr-8 text-base font-semibold text-brand-heading">{modalTitle}</h2>
        <p className="sr-only">
          Verschiebbare OpenStreetMap-Karte mit Zoom und Markierung für den Campingplatz. Schließen
          über die Schaltfläche oben rechts oder per Zurück / Wischen.
        </p>
        {interactiveOpen ? (
          <div
            data-vaul-no-drag=""
            className="map-embed relative min-h-0 flex-1 overflow-hidden rounded-lg border border-subtle bg-muted"
          >
            <CampingplatzLeafletMap
              key={`dialog-${pointsKey}`}
              mapKey={`dialog-${pointsKey}`}
              lat={lat}
              lng={lng}
              label={pinLabel}
              interactive
              className="absolute inset-0 z-0"
            />
          </div>
        ) : null}
      </ResponsiveModal>
    </>
  )
}
