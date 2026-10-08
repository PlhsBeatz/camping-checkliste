import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import { getEdgeCache } from '@/lib/edge-cache'
import {
  fetchPitchOverpassElements,
  estimateOrientationFromOsmWays,
  pitchOrientationCacheGrid,
} from '@/lib/pitch-orientation-osm'

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

function pitchCacheKey(lat: number, lng: number): Request {
  const g = pitchOrientationCacheGrid(lat, lng)
  return new Request(
    `https://camping-checkliste.pitch-cache/${g.lat}/${g.lng}`,
    { method: 'GET' }
  )
}

/**
 * GET /api/pitch-orientation?lat=&lng=
 * OSM-Wege/Hecken → Parzellen-Ausrichtung.
 *
 * Bevorzugt Client-seitiges Overpass (kein Worker-CPU).
 * Diese Route ist Fallback + Edge-Cache; bewusst leicht für Workers Free (~10 ms CPU).
 */
export async function GET(request: NextRequest) {
  try {
    const lat = parseCoord(request.nextUrl.searchParams.get('lat'))
    const lng = parseCoord(request.nextUrl.searchParams.get('lng'))
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'lat/lng ungültig' }, { status: 400 })
    }

    const cacheKey = pitchCacheKey(lat, lng)
    const edgeCache = getEdgeCache()
    if (edgeCache) {
      try {
        const cached = await edgeCache.match(cacheKey)
        if (cached) {
          const headers = new Headers(cached.headers)
          headers.set('X-Pitch-Cache', 'HIT')
          return new NextResponse(cached.body, { status: cached.status, headers })
        }
      } catch {
        // ignore
      }
    }

    const auth = await requireSession(request)
    if (auth instanceof NextResponse) return auth

    // Kurzes Timeout, kleine Antwort – CPU bleibt beim JSON-Parse unter Free-Limit
    const elements = await fetchPitchOverpassElements(lat, lng, 40, {
      timeoutMs: 6_000,
      maxBytes: 180_000,
    })
    if (!elements) {
      return NextResponse.json(
        { ok: false, error: 'OpenStreetMap-Daten nicht erreichbar', result: null },
        { status: 502 }
      )
    }

    const result = estimateOrientationFromOsmWays(lat, lng, elements, 40)

    const out = NextResponse.json({
      ok: true,
      result,
      elementCount: elements.length,
    })
    out.headers.set('Cache-Control', 'private, max-age=3600')
    out.headers.set('X-Pitch-Cache', 'MISS')

    if (edgeCache) {
      try {
        const toCache = out.clone()
        const headers = new Headers(toCache.headers)
        headers.set(
          'Cache-Control',
          'public, max-age=86400, s-maxage=86400'
        )
        headers.delete('Set-Cookie')
        await edgeCache.put(
          cacheKey,
          new Response(toCache.body, { status: toCache.status, headers })
        )
      } catch {
        // ignore
      }
    }

    return out
  } catch (err) {
    console.error('pitch-orientation', err)
    return NextResponse.json({ error: 'Ausrichtung fehlgeschlagen' }, { status: 500 })
  }
}
