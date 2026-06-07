import type { Campingplatz } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'

/** ADAC-Places-Format: lat_lng_typ_routingPointType */
export function formatAdacPlace(
  lat: number,
  lng: number,
  type: 1 | 6 = 6
): string {
  return `${lat.toFixed(5)}_${lng.toFixed(5)}_${type}_0`
}

/**
 * ADAC-Routen-URL (Gespann). `departure` aktiviert verkehrsabhängige Planung für „jetzt“
 * (von ADAC in parseTravelTimeOptions ausgewertet).
 */
export function buildAdacRouteUrl(places: string, departure: Date = new Date()): string {
  const params = new URLSearchParams({
    'vehicle-type': 'trailer',
    places,
    departure: departure.toISOString(),
  })
  return `https://maps.adac.de/route?${params.toString()}`
}

export async function openCampingplatzInAdacMaps(
  campingplatz: Campingplatz,
  homeCoords?: { lat: number; lng: number } | null
): Promise<void> {
  if (campingplatz.lat == null || campingplatz.lng == null) {
    const labelFallback = `${campingplatz.name}, ${campingplatz.ort}, ${campingplatz.land}`
    window.open(
      `https://maps.adac.de/routenplaner?poi=${encodeURIComponent(labelFallback)}`,
      '_blank'
    )
    return
  }

  let coords = homeCoords ?? null
  if (coords == null) {
    try {
      const res = await fetch('/api/profile/home-location')
      const data = (await res.json()) as ApiResponse<{
        heimat_lat: number | null
        heimat_lng: number | null
      }>
      if (
        data.success &&
        data.data?.heimat_lat != null &&
        data.data.heimat_lng != null
      ) {
        coords = { lat: data.data.heimat_lat, lng: data.data.heimat_lng }
      }
    } catch {
      coords = null
    }
  }

  if (!coords) {
    window.open(
      buildAdacRouteUrl(formatAdacPlace(campingplatz.lat, campingplatz.lng, 6)),
      '_blank'
    )
    return
  }

  const start = formatAdacPlace(coords.lat, coords.lng, 1)
  const target = formatAdacPlace(campingplatz.lat, campingplatz.lng, 6)
  window.open(buildAdacRouteUrl(`${start},${target}`), '_blank')
}
