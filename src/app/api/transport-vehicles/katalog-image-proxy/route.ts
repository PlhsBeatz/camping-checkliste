import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/**
 * GET /api/transport-vehicles/katalog-image-proxy?url=
 * Vorschau fremder Bild-URLs (Hersteller) – umgeht Hotlink-/CORS-Probleme in der UI.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const raw = request.nextUrl.searchParams.get('url')?.trim()
    if (!raw) {
      return NextResponse.json({ error: 'url erforderlich' }, { status: 400 })
    }
    let parsed: URL
    try {
      parsed = new URL(raw)
    } catch {
      return NextResponse.json({ error: 'Ungültige URL' }, { status: 400 })
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return NextResponse.json({ error: 'Nur http(s) erlaubt' }, { status: 400 })
    }

    const res = await fetch(parsed.toString(), {
      redirect: 'follow',
      headers: {
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'User-Agent': BROWSER_UA,
        Referer: parsed.origin + '/',
      },
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Bild nicht ladbar (HTTP ${res.status})` },
        { status: 502 }
      )
    }
    const mime = (res.headers.get('content-type') || '').split(';')[0]?.trim() || 'image/jpeg'
    if (!mime.startsWith('image/') && !mime.includes('octet-stream')) {
      return NextResponse.json({ error: 'Antwort ist kein Bild' }, { status: 415 })
    }
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 200 || buf.byteLength > 8_000_000) {
      return NextResponse.json({ error: 'Bildgröße ungültig' }, { status: 400 })
    }
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': mime.startsWith('image/') ? mime : 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
