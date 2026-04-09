'use client'

/**
 * Schlichte Übersichtskarte (OpenStreetMap-Embed): grober Kontext inkl. Nachbarregionen.
 * Nur sinnvoll, wenn Koordinaten vorliegen.
 */
export function CampingplatzOverviewMap({
  lat,
  lng,
  title,
}: {
  lat: number
  lng: number
  title?: string
}) {
  const dLat = 3.4
  const dLon = 5.2
  let minLat = lat - dLat
  let maxLat = lat + dLat
  let minLng = lng - dLon
  let maxLng = lng + dLon
  minLat = Math.max(-85, minLat)
  maxLat = Math.min(85, maxLat)
  minLng = Math.max(-180, minLng)
  maxLng = Math.min(180, maxLng)

  const bbox = `${minLng},${minLat},${maxLng},${maxLat}`
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`
  const osmLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=7/${lat}/${lng}`

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
        <iframe
          title={title ? `Lage: ${title}` : 'Lageübersicht'}
          src={src}
          className="absolute inset-0 h-full w-full border-0 [color-scheme:light] contrast-[0.93] saturate-[0.72]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a
        href={osmLink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Größere Karte auf OpenStreetMap
      </a>
    </div>
  )
}
