import {
  SATELLITE_MAX_NATIVE_ZOOM,
  SATELLITE_MAX_ZOOM,
  SATELLITE_MIN_ZOOM,
  satelliteTileUrl,
} from '@/lib/satellite-tiles'

const CACHE_NAME = 'camping-satellite-tiles-v2'
/** Obergrenze grob ~40 MB (bei ~25 KB/Tile) */
const MAX_TILES = 1600

type TileCoord = { z: number; x: number; y: number }

function latLngToTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  )
  return { x, y }
}

function tileKey(z: number, x: number, y: number): string {
  return satelliteTileUrl(z, x, y)
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

/** LRU-ähnlich: älteste Einträge entfernen wenn zu voll. */
async function trimCache(cache: Cache): Promise<void> {
  const keys = await cache.keys()
  if (keys.length <= MAX_TILES) return
  const removeCount = keys.length - MAX_TILES
  for (let i = 0; i < removeCount; i++) {
    const req = keys[i]
    if (req) await cache.delete(req)
  }
}

export async function getCachedSatelliteTile(url: string): Promise<Response | null> {
  const cache = await openCache()
  if (!cache) return null
  try {
    const hit = await cache.match(url)
    return hit ?? null
  } catch {
    return null
  }
}

export async function putCachedSatelliteTile(url: string, response: Response): Promise<void> {
  const cache = await openCache()
  if (!cache) return
  try {
    if (!response.ok) return
    const clone = response.clone()
    await cache.put(url, clone)
    await trimCache(cache)
  } catch {
    // ignore
  }
}

/**
 * Tile laden: Cache zuerst, sonst Netz + speichern.
 * Offline ohne Cache → null.
 */
export async function loadSatelliteTile(url: string): Promise<Response | null> {
  const cached = await getCachedSatelliteTile(url)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null
  }

  try {
    // no-cors liefert opaque Response → Cache möglich, Blob aber nicht lesbar.
    // Deshalb cors versuchen; scheitert (mobil/SW) → null, Aufrufer nutzt img.src.
    const res = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      // SW soll diese Requests möglichst nicht umschreiben
      cache: 'no-store',
    })
    if (!res.ok) return null
    // Vor Cache-Put klonen – Original für Aufrufer behalten
    const forCaller = res.clone()
    await putCachedSatelliteTile(url, res)
    return forCaller
  } catch {
    return null
  }
}

/** Prefetch um ein Zentrum herum (nur native Esri-Zoomstufen, stark begrenzt). */
export async function prefetchSatelliteAround(
  lat: number,
  lng: number,
  opts?: { minZoom?: number; maxZoom?: number; radiusTiles?: number }
): Promise<{ fetched: number; cached: number; failed: number }> {
  // Nie über maxNativeZoom hinaus – Esri liefert dort 404 und erzeugt Last/Fehler
  const minZ = opts?.minZoom ?? Math.max(SATELLITE_MIN_ZOOM, 17)
  const maxZ = Math.min(
    opts?.maxZoom ?? SATELLITE_MAX_NATIVE_ZOOM,
    SATELLITE_MAX_NATIVE_ZOOM
  )
  const radius = opts?.radiusTiles ?? 1
  let fetched = 0
  let cached = 0
  let failed = 0

  for (let z = minZ; z <= maxZ; z++) {
    const center = latLngToTile(lat, lng, z)
    const maxIndex = 2 ** z - 1
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = Math.min(maxIndex, Math.max(0, center.x + dx))
        const y = Math.min(maxIndex, Math.max(0, center.y + dy))
        const url = tileKey(z, x, y)
        const existing = await getCachedSatelliteTile(url)
        if (existing) {
          cached++
          continue
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          failed++
          continue
        }
        const res = await loadSatelliteTile(url)
        if (res) fetched++
        else failed++
      }
    }
  }

  return { fetched, cached, failed }
}

export function tileCoordsAround(
  lat: number,
  lng: number,
  z: number,
  radiusTiles: number
): TileCoord[] {
  const center = latLngToTile(lat, lng, z)
  const maxIndex = 2 ** z - 1
  const out: TileCoord[] = []
  for (let dx = -radiusTiles; dx <= radiusTiles; dx++) {
    for (let dy = -radiusTiles; dy <= radiusTiles; dy++) {
      out.push({
        z,
        x: Math.min(maxIndex, Math.max(0, center.x + dx)),
        y: Math.min(maxIndex, Math.max(0, center.y + dy)),
      })
    }
  }
  return out
}
