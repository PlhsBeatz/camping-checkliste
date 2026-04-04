import { NextRequest, NextResponse } from 'next/server'
import type { D1Database } from '@cloudflare/workers-types'
import { CloudflareEnv, getDB, getCampingPhotosR2 } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { buildPlacesPhotoMediaUrl } from '@/lib/places-photo'

async function getFotoRow(db: D1Database, fotoId: string) {
  return db
    .prepare(
      `SELECT id, campingplatz_id, r2_object_key, google_photo_name, content_type
       FROM campingplatz_fotos WHERE id = ?`
    )
    .bind(fotoId)
    .first<{
      id: string
      campingplatz_id: string
      r2_object_key: string | null
      google_photo_name: string | null
      content_type: string | null
    }>()
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fotoId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { fotoId } = await context.params
    if (!fotoId) {
      return NextResponse.json({ error: 'Fehlende Foto-ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const row = await getFotoRow(db, fotoId)
    if (!row) {
      return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })
    }

    const maxWidthPx = Math.min(
      1600,
      Math.max(1, Math.round(Number(new URL(request.url).searchParams.get('maxWidthPx') || 800)))
    )

    const bucket = getCampingPhotosR2(env)
    if (row.r2_object_key && bucket) {
      const obj = await bucket.get(row.r2_object_key)
      if (!obj) {
        return NextResponse.json({ error: 'Datei fehlt' }, { status: 404 })
      }
      const contentType = obj.httpMetadata?.contentType || row.content_type || 'image/jpeg'
      const arr = await obj.arrayBuffer()
      return new NextResponse(arr, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=604800, s-maxage=604800',
        },
      })
    }

    const googleName = row.google_photo_name
    if (!googleName || !googleName.startsWith('places/')) {
      return NextResponse.json({ error: 'Keine Bilddaten' }, { status: 404 })
    }

    const apiKey = env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google API nicht konfiguriert' }, { status: 503 })
    }

    const googleUrl = buildPlacesPhotoMediaUrl(googleName, maxWidthPx, apiKey)
    const upstream = await fetch(googleUrl, { redirect: 'follow', headers: { Accept: 'image/*' } })
    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 })
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
