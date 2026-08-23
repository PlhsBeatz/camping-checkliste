import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getOptimierungById,
  deleteOptimierungFoto,
  getCampingPhotosR2,
} from '@/lib/db'
import { requireAuth, requireWriteOptimierung } from '@/lib/api-auth'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; fotoId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const writeErr = requireWriteOptimierung(auth.userContext)
    if (writeErr) return writeErr

    const { id: optimierungId, fotoId } = await context.params
    if (!optimierungId || !fotoId) {
      return NextResponse.json({ success: false, error: 'Fehlende Parameter' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const opt = await getOptimierungById(db, optimierungId)
    if (!opt) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const { deleted, r2_object_key } = await deleteOptimierungFoto(db, optimierungId, fotoId)
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
