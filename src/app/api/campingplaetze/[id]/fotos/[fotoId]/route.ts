import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingplatzById,
  deleteCampingplatzFoto,
  setCampingplatzCoverFoto,
  getCampingPhotosR2,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; fotoId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id: campingplatzId, fotoId } = await context.params
    if (!campingplatzId || !fotoId) {
      return NextResponse.json({ success: false, error: 'Fehlende Parameter' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const cp = await getCampingplatzById(db, campingplatzId)
    if (!cp) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const { deleted, r2_object_key } = await deleteCampingplatzFoto(db, campingplatzId, fotoId)
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Foto nicht gefunden' }, { status: 404 })
    }

    if (r2_object_key) {
      const bucket = await getCampingPhotosR2(env)
      if (bucket) {
        await bucket.delete(r2_object_key)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; fotoId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id: campingplatzId, fotoId } = await context.params
    if (!campingplatzId || !fotoId) {
      return NextResponse.json({ success: false, error: 'Fehlende Parameter' }, { status: 400 })
    }

    const body = (await request.json()) as { setCover?: boolean }
    if (!body.setCover) {
      return NextResponse.json({ success: false, error: 'setCover erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const cp = await getCampingplatzById(db, campingplatzId)
    if (!cp) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const ok = await setCampingplatzCoverFoto(db, campingplatzId, fotoId)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Cover konnte nicht gesetzt werden' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
