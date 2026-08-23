import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getFaelligkeit,
  getFaelligkeitHistorieEntry,
  updateFaelligkeitHistorie,
  deleteFaelligkeitHistorie,
  type CloudflareEnv,
  type FaelligkeitEreignisTyp,
} from '@/lib/db'
import { requireAuth, requireWriteWartung } from '@/lib/api-auth'

interface HistorieUpdateBody {
  ereignis_typ?: FaelligkeitEreignisTyp
  datum?: string
  notiz?: string | null
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historieId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireWriteWartung(auth.userContext)
    if (adminErr) return adminErr

    const { id, historieId } = await params
    const body = (await request.json()) as HistorieUpdateBody

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const exists = await getFaelligkeit(db, id)
    if (!exists) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const existing = await getFaelligkeitHistorieEntry(db, historieId)
    if (!existing || existing.faelligkeit_id !== id) {
      return NextResponse.json({ error: 'Historieneintrag nicht gefunden' }, { status: 404 })
    }

    const entry = await updateFaelligkeitHistorie(db, historieId, body)
    if (!entry) {
      return NextResponse.json({ error: 'Historie konnte nicht aktualisiert werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: entry })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; historieId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireWriteWartung(auth.userContext)
    if (adminErr) return adminErr

    const { id, historieId } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const exists = await getFaelligkeit(db, id)
    if (!exists) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const existing = await getFaelligkeitHistorieEntry(db, historieId)
    if (!existing || existing.faelligkeit_id !== id) {
      return NextResponse.json({ error: 'Historieneintrag nicht gefunden' }, { status: 404 })
    }

    const ok = await deleteFaelligkeitHistorie(db, historieId)
    if (!ok) {
      return NextResponse.json({ error: 'Historie konnte nicht gelöscht werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
