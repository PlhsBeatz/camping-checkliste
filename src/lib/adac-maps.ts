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

export type AdacPlaceInput = {
  name: string
  lat?: number | null
  lng?: number | null
  ort?: string | null
  land?: string | null
  adresse?: string | null
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

export function buildAdacPoiSearchUrl(place: AdacPlaceInput): string {
  const label = [place.name, place.adresse, place.ort, place.land]
    .filter((p) => p != null && String(p).trim())
    .join(', ')
  return `https://maps.adac.de/routenplaner?poi=${encodeURIComponent(label)}`
}

/** ADAC-Route braucht Start + Ziel; ohne Heimat nutzen wir einen nahen Pseudo-Start. */
function approximateRouteStart(lat: number, lng: number): { lat: number; lng: number } {
  const deltaKm = 3
  return { lat: lat + deltaKm / 110.574, lng }
}

export function buildAdacRouteToCoordinates(
  lat: number,
  lng: number,
  start?: { lat: number; lng: number } | null
): string {
  const origin = start ?? approximateRouteStart(lat, lng)
  const startPlace = formatAdacPlace(origin.lat, origin.lng, 1)
  const targetPlace = formatAdacPlace(lat, lng, 6)
  return buildAdacRouteUrl(`${startPlace},${targetPlace}`)
}

async function fetchHomeCoords(): Promise<{ lat: number; lng: number } | null> {
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
      return { lat: data.data.heimat_lat, lng: data.data.heimat_lng }
    }
  } catch {
    /* offline / kein Profil */
  }
  return null
}

export async function openPlaceInAdacMaps(
  place: AdacPlaceInput,
  homeCoords?: { lat: number; lng: number } | null
): Promise<void> {
  if (place.lat == null || place.lng == null) {
    window.open(buildAdacPoiSearchUrl(place), '_blank')
    return
  }

  let coords = homeCoords ?? null
  if (coords == null) {
    coords = await fetchHomeCoords()
  }

  window.open(buildAdacRouteToCoordinates(place.lat, place.lng, coords), '_blank')
}

export async function openCampingplatzInAdacMaps(
  campingplatz: Campingplatz,
  homeCoords?: { lat: number; lng: number } | null
): Promise<void> {
  await openPlaceInAdacMaps(
    {
      name: campingplatz.name,
      lat: campingplatz.lat,
      lng: campingplatz.lng,
      ort: campingplatz.ort,
      land: campingplatz.land,
      adresse: campingplatz.adresse,
    },
    homeCoords
  )
}
