import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import {
  DE_OSM_TILE_URL,
  SATELLITE_MAX_NATIVE_ZOOM,
  satelliteTileUrl,
} from '@/lib/satellite-tiles'

const BROWSER_UA =
  'Mozilla/5.0 (compatible; CampingCheckliste/1.0; +https://localhost) AppleWebKit/537.36'

type TileSource = 'satellite' | 'osm'

function parseIntParam(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isInteger(n)) return null
  return n
}

function resolveUpstream(source: TileSource, z: number, x: number, y: number): string {
  if (source === 'satellite') return satelliteTileUrl(z, x, y)
  const sub = ['a', 'b', 'c'][(x + y) % 3]!
  return DE_OSM_TILE_URL.replace('{s}', sub)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

function tileCacheKey(source: TileSource, z: number, x: number, y: number): Request {
  // Öffentliche Kacheln – Cache-Key unabhängig von Cookies/Auth
  return new Request(`https://camping-checkliste.tile-cache/${source}/${z}/${x}/${y}`, {
    method: 'GET',
  })
}

/**
 * GET /api/map-tiles/:source/:z/:x/:y
 * Proxy für Esri-/OSM-Kacheln (CORS-frei für Canvas).
 * Free-Tier: JWT-only Auth, Edge-Cache, kein D1.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ source: string; z: string; x: string; y: string }> }
) {
  try {
    const params = await context.params
    const sourceRaw = params.source
    if (sourceRaw !== 'satellite' && sourceRaw !== 'osm') {
      return NextResponse.json({ error: 'Ungültige Quelle' }, { status: 400 })
    }
    const source = sourceRaw as TileSource
    const z = parseIntParam(params.z)
    const x = parseIntParam(params.x)
    const y = parseIntParam(params.y)
    if (z == null || x == null || y == null) {
      return NextResponse.json({ error: 'Ungültige Kachelkoordinaten' }, { status: 400 })
    }
    if (z < 14 || z > SATELLITE_MAX_NATIVE_ZOOM) {
      return NextResponse.json({ error: 'Zoom außerhalb 14–19' }, { status: 400 })
    }
    const maxIndex = 2 ** z - 1
    if (x < 0 || y < 0 || x > maxIndex || y > maxIndex) {
      return NextResponse.json({ error: 'Kachel außerhalb des Rasters' }, { status: 400 })
    }

    const cacheKey = tileCacheKey(source, z, x, y)
    try {
      const cached = await caches.default.match(cacheKey)
      if (cached) {
        // Cache-Treffer: Auth überspringen (Kacheln sind öffentlich)
        const headers = new Headers(cached.headers)
        headers.set('X-Tile-Cache', 'HIT')
        return new NextResponse(cached.body, { status: cached.status, headers })
      }
    } catch {
      // Cache API nicht verfügbar (lokal) – weiter ohne Cache
    }

    const auth = await requireSession(request)
    if (auth instanceof NextResponse) return auth

    const upstream = resolveUpstream(source, z, x, y)
    const res = await fetch(upstream, {
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': BROWSER_UA,
      },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: `Kachel nicht ladbar (HTTP ${res.status})` },
        { status: 502 }
      )
    }

    const buf = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const out = new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Tile-Cache': 'MISS',
      },
    })

    try {
      await caches.default.put(cacheKey, out.clone())
    } catch {
      // ignore
    }

    return out
  } catch (err) {
    console.error('map-tiles proxy', err)
    return NextResponse.json({ error: 'Kachel-Proxy fehlgeschlagen' }, { status: 500 })
  }
}
