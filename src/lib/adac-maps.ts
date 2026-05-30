import type { Campingplatz } from '@/lib/db'
import type { ApiResponse } from '@/lib/api-types'

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
    const targetOnly = `${campingplatz.lat.toFixed(5)}_${campingplatz.lng.toFixed(5)}_6_0`
    window.open(
      `https://maps.adac.de/route?vehicle-type=trailer&places=${targetOnly}`,
      '_blank'
    )
    return
  }

  const start = `${coords.lat.toFixed(5)}_${coords.lng.toFixed(5)}_1_0`
  const target = `${campingplatz.lat.toFixed(5)}_${campingplatz.lng.toFixed(5)}_6_0`
  window.open(
    `https://maps.adac.de/route?vehicle-type=trailer&places=${start},${target}`,
    '_blank'
  )
}
