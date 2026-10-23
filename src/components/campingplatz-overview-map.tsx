'use client'

import { useMemo, useState } from 'react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { cn } from '@/lib/utils'

/** ~30 % näher als zuvor: Bounding-Box auf ca. 70 % der früheren Ausdehnung */
const ZOOM_IN_FACTOR = 0.7

function buildOsmEmbedSrc(lat: number, lng: number) {
  const dLat = 3.4 * ZOOM_IN_FACTOR
  const dLon = 5.2 * ZOOM_IN_FACTOR
  let minLat = lat - dLat
  let maxLat = lat + dLat
  let minLng = lng - dLon
  let maxLng = lng + dLon
  minLat = Math.max(-85, minLat)
  maxLat = Math.min(85, maxLat)
  minLng = Math.max(-180, minLng)
  maxLng = Math.min(180, maxLng)

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`
}

export function CampingplatzOverviewMap({
  lat,
  lng,
  title,
}: {
  lat: number
  lng: number
  title?: string
}) {
  const [interactiveOpen, setInteractiveOpen] = useState(false)

  const embedSrc = useMemo(() => buildOsmEmbedSrc(lat, lng), [lat, lng])
  const previewLabel = title ? `Interaktive Karte zu „${title}“ öffnen` : 'Interaktive Karte öffnen'
  const modalTitle = title ? `Lage: ${title}` : 'Interaktive Karte'

  return (
    <>
      <div
        className={cn(
          'max-md:relative max-md:left-1/2 max-md:w-screen max-md:max-w-none max-md:-translate-x-1/2',
          'md:left-auto md:w-full md:translate-x-0'
        )}
      >
        <div
          className={cn(
            'map-embed relative block w-full overflow-hidden border border-subtle bg-muted shadow-sm',
            'aspect-[2/1] max-md:rounded-none md:aspect-[3/1] md:rounded-xl'
          )}
        >
          {/* Gleiche OSM-Embed-URL wie im Dialog; pointer-events-none = keine Bedienung, bis zur Overlay-Schaltfläche */}
          <iframe
            title="Kartenvorschau"
            src={embedSrc}
            tabIndex={-1}
            aria-hidden="true"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full border-0 [color-scheme:light] contrast-[0.93] saturate-[0.72]"
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
          // Feste Höhe nötig: Sonst kollabiert flex-1 beim Kartenbereich (iframe nur absolute → ~0px).
          'flex h-[min(90dvh,760px)] min-h-0 w-full max-w-none flex-col gap-3 overflow-hidden p-4 sm:w-[min(96vw,920px)] sm:p-5'
        )}
      >
        <h2 className="shrink-0 pr-8 text-base font-semibold text-brand-heading">{modalTitle}</h2>
        <p className="sr-only">
          Verschiebbare OpenStreetMap-Karte mit Zoom. Schließen über die Schaltfläche oben rechts oder
          per Zurück / Wischen.
        </p>
        {interactiveOpen ? (
          <div
            data-vaul-no-drag=""
            className="map-embed relative min-h-0 flex-1 overflow-hidden rounded-lg border border-subtle bg-muted"
          >
            <iframe
              title={modalTitle}
              src={embedSrc}
              className="absolute inset-0 h-full w-full border-0 [color-scheme:light] contrast-[0.93] saturate-[0.72]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        ) : null}
      </ResponsiveModal>
    </>
  )
}
