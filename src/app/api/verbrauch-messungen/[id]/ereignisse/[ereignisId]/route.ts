import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  updateVerbrauchEreignis,
  deleteVerbrauchEreignis,
  getVerbrauchMessung,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireWriteWartung } from '@/lib/api-auth'

interface EreignisUpdateBody {
  menge?: number
  datum?: string | null
  notizen?: string | null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ereignisId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const writeErr = requireWriteWartung(auth.userContext)
    if (writeErr) return writeErr

    const { id, ereignisId } = await params
    const body = (await request.json()) as EreignisUpdateBody
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await updateVerbrauchEreignis(db, ereignisId, body)
    if (!item || item.messung_id !== id) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    const messung = await getVerbrauchMessung(db, id)
    return NextResponse.json({ success: true, data: { ereignis: item, messung } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ereignisId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const writeErr = requireWriteWartung(auth.userContext)
    if (writeErr) return writeErr

    const { id, ereignisId } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await deleteVerbrauchEreignis(db, ereignisId)
    if (!ok) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    const messung = await getVerbrauchMessung(db, id)
    return NextResponse.json({ success: true, data: { messung } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
