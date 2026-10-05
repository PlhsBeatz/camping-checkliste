import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/api-auth'
import {
  OVERPASS_ENDPOINTS,
  buildPitchOverpassQuery,
  estimateOrientationFromOsmWays,
} from '@/lib/pitch-orientation-osm'
import type { OsmOverpassResponse } from '@/lib/pitch-orientation-osm'

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

async function fetchOverpass(query: string): Promise<OsmOverpassResponse | null> {
  // Free-Tier: max. 2 Subrequests, Timeout damit der Worker nicht hängt
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      return (await res.json()) as OsmOverpassResponse
    } catch {
      // nächsten Endpoint versuchen
    }
  }
  return null
}

/**
 * GET /api/pitch-orientation?lat=&lng=
 * OSM-Wege/Hecken → Parzellen-Ausrichtung.
 * Free-Tier: JWT-only Auth (kein D1), 1–2 Overpass-Subrequests.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession(request)
    if (auth instanceof NextResponse) return auth

    const lat = parseCoord(request.nextUrl.searchParams.get('lat'))
    const lng = parseCoord(request.nextUrl.searchParams.get('lng'))
    if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: 'lat/lng ungültig' }, { status: 400 })
    }

    const query = buildPitchOverpassQuery(lat, lng, 55)
    const data = await fetchOverpass(query)
    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'OpenStreetMap-Daten nicht erreichbar', result: null },
        { status: 502 }
      )
    }

    const elements = data.elements ?? []
    const result = estimateOrientationFromOsmWays(lat, lng, elements, 50)

    return NextResponse.json({
      ok: true,
      result,
      elementCount: elements.length,
    })
  } catch (err) {
    console.error('pitch-orientation', err)
    return NextResponse.json({ error: 'Ausrichtung fehlgeschlagen' }, { status: 500 })
  }
}
