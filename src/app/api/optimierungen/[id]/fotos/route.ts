import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getOptimierungById,
  getOptimierungFotos,
  createOptimierungFoto,
  updateOptimierungFotoR2,
  buildOptimierungFotoObjectKey,
  getCampingPhotosR2,
} from '@/lib/db'
import { requireAuth, requireWriteOptimierung, requireReadOptimierung } from '@/lib/api-auth'
import { optimizeCampingPhotoToWebp } from '@/lib/camping-photo-optimize'

const UPLOAD_MAX_BYTES = 32 * 1024 * 1024
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const readErr = requireReadOptimierung(auth.userContext)
    if (readErr) return readErr

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const opt = await getOptimierungById(db, id)
    if (!opt) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const fotos = await getOptimierungFotos(db, id)
    return NextResponse.json({ success: true, data: fotos })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const writeErr = requireWriteOptimierung(auth.userContext)
    if (writeErr) return writeErr

    const { id: optimierungId } = await context.params
    if (!optimierungId) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const opt = await getOptimierungById(db, optimierungId)
    if (!opt) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const bucket = await getCampingPhotosR2(env)
    if (!bucket) {
      return NextResponse.json(
        { success: false, error: 'R2-Speicher nicht konfiguriert' },
        { status: 503 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'multipart/form-data erwartet' },
        { status: 400 }
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Datei fehlt' }, { status: 400 })
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Datei zu groß (max. 32 MB). Bitte kleineres Bild wählen.' },
        { status: 400 }
      )
    }
    const mime = file.type || 'image/jpeg'
    if (!ALLOWED_UPLOAD_TYPES.has(mime)) {
      return NextResponse.json(
        { success: false, error: 'Nur JPEG, PNG oder WebP erlaubt' },
        { status: 400 }
      )
    }

    const buf = new Uint8Array(await file.arrayBuffer())
    const optimized = await optimizeCampingPhotoToWebp(buf, mime)
    const outBytes = optimized.ok ? optimized.data : buf
    const outMime: string = optimized.ok ? 'image/webp' : mime

    const created = await createOptimierungFoto(db, {
      optimierung_id: optimierungId,
      content_type: outMime,
    })
    if (!created?.id) {
      return NextResponse.json(
        { success: false, error: 'Foto konnte nicht angelegt werden' },
        { status: 500 }
      )
    }

    const objectKey = buildOptimierungFotoObjectKey(optimierungId, created.id, outMime)
    await bucket.put(objectKey, outBytes, { httpMetadata: { contentType: outMime } })
    const updated = await updateOptimierungFotoR2(db, created.id, objectKey, outMime)
    return NextResponse.json({ success: true, data: updated }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
