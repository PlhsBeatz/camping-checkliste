import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingplatzById,
  getCampingplatzFotos,
  createCampingplatzFoto,
  updateCampingplatzFotoR2,
  getCampingPhotosR2,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import {
  buildCampingplatzFotoObjectKey,
  downloadGooglePlacePhotoToR2,
} from '@/lib/campingplatz-foto-import'

const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const cp = await getCampingplatzById(db, id)
    if (!cp) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const fotos = await getCampingplatzFotos(db, id)
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
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id: campingplatzId } = await context.params
    if (!campingplatzId) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const cp = await getCampingplatzById(db, campingplatzId)
    if (!cp) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const contentType = request.headers.get('content-type') || ''
    const bucket = getCampingPhotosR2(env)
    const googleKey = env.GOOGLE_MAPS_API_KEY

    if (contentType.includes('multipart/form-data')) {
      if (!bucket) {
        return NextResponse.json(
          { success: false, error: 'R2-Speicher nicht konfiguriert' },
          { status: 503 }
        )
      }
      const form = await request.formData()
      const file = form.get('file')
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ success: false, error: 'Datei fehlt' }, { status: 400 })
      }
      if (file.size > UPLOAD_MAX_BYTES) {
        return NextResponse.json({ success: false, error: 'Datei zu groß (max. 5 MB)' }, { status: 400 })
      }
      const mime = file.type || 'image/jpeg'
      if (!ALLOWED_UPLOAD_TYPES.has(mime)) {
        return NextResponse.json(
          { success: false, error: 'Nur JPEG, PNG oder WebP erlaubt' },
          { status: 400 }
        )
      }
      const setAsCover = form.get('setAsCover') === 'true' || form.get('setAsCover') === '1'
      const buf = new Uint8Array(await file.arrayBuffer())
      const created = await createCampingplatzFoto(db, {
        campingplatz_id: campingplatzId,
        source: 'upload',
        content_type: mime,
        setAsCover,
      })
      if (!created?.id) {
        return NextResponse.json({ success: false, error: 'Foto konnte nicht angelegt werden' }, { status: 500 })
      }
      const objectKey = buildCampingplatzFotoObjectKey(campingplatzId, created.id, mime)
      await bucket.put(objectKey, buf, { httpMetadata: { contentType: mime } })
      const updated = await updateCampingplatzFotoR2(db, created.id, objectKey, mime)
      return NextResponse.json({ success: true, data: updated }, { status: 201 })
    }

    const body = (await request.json()) as {
      google_photo_name?: string
      google_attributions?: string[]
      importToR2?: boolean
      setAsCover?: boolean
    }
    const name = body.google_photo_name?.trim()
    if (!name || !name.startsWith('places/')) {
      return NextResponse.json(
        { success: false, error: 'google_photo_name (places/…) erforderlich' },
        { status: 400 }
      )
    }

    const importToR2 = body.importToR2 !== false
    const foto = await createCampingplatzFoto(db, {
      campingplatz_id: campingplatzId,
      source: 'google',
      google_photo_name: name,
      google_attributions: body.google_attributions ?? null,
      setAsCover: body.setAsCover === true,
    })
    if (!foto) {
      return NextResponse.json({ success: false, error: 'Foto konnte nicht angelegt werden' }, { status: 500 })
    }

    if (importToR2 && bucket && googleKey) {
      const objectKey = buildCampingplatzFotoObjectKey(campingplatzId, foto.id, 'image/jpeg')
      const imported = await downloadGooglePlacePhotoToR2({
        bucket,
        apiKey: googleKey,
        googlePhotoName: name,
        r2ObjectKey: objectKey,
      })
      if (imported) {
        const updated = await updateCampingplatzFotoR2(
          db,
          foto.id,
          objectKey,
          imported.contentType
        )
        return NextResponse.json({ success: true, data: updated }, { status: 201 })
      }
    }

    return NextResponse.json({ success: true, data: foto }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
