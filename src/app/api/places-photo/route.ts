import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { buildPlacesPhotoMediaUrl } from '@/lib/places-photo'
import type { CloudflareEnv } from '@/lib/db'

const MAX_WIDTH = 1600
const DEFAULT_WIDTH = 400

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')?.trim()
    if (!name || !name.startsWith('places/')) {
      return NextResponse.json({ error: 'Ungültiger Foto-Name' }, { status: 400 })
    }

    let maxWidthPx = Number(searchParams.get('maxWidthPx') || DEFAULT_WIDTH)
    if (!Number.isFinite(maxWidthPx) || maxWidthPx < 1) maxWidthPx = DEFAULT_WIDTH
    maxWidthPx = Math.min(Math.round(maxWidthPx), MAX_WIDTH)

    const env = process.env as unknown as CloudflareEnv
    const apiKey = env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API-Key nicht konfiguriert' },
        { status: 503 }
      )
    }

    const googleUrl = buildPlacesPhotoMediaUrl(name, maxWidthPx, apiKey)
    const upstream = await fetch(googleUrl, {
      redirect: 'follow',
      headers: { Accept: 'image/*' },
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Google Places Foto: ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 }
      )
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    const buf = await upstream.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
