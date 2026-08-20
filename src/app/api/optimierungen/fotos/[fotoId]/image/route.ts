import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getCampingPhotosR2, getOptimierungFotoById } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fotoId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { fotoId } = await context.params
    if (!fotoId) {
      return NextResponse.json({ error: 'Fehlende Foto-ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const foto = await getOptimierungFotoById(db, fotoId)
    if (!foto?.r2_object_key) {
      return NextResponse.json({ error: 'Foto nicht gefunden' }, { status: 404 })
    }

    const bucket = await getCampingPhotosR2(env)
    if (!bucket) {
      return NextResponse.json({ error: 'R2-Speicher nicht konfiguriert' }, { status: 503 })
    }

    const obj = await bucket.get(foto.r2_object_key)
    if (!obj) {
      return NextResponse.json({ error: 'Datei fehlt' }, { status: 404 })
    }

    const contentType =
      obj.httpMetadata?.contentType || foto.content_type || 'image/jpeg'
    const arr = await obj.arrayBuffer()
    return new NextResponse(arr, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=604800',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
