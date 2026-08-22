import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getFaelligkeitHistorieView,
  addFaelligkeitHistorie,
  getFaelligkeit,
  type CloudflareEnv,
  type FaelligkeitEreignisTyp,
} from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

interface HistorieBody {
  ereignis_typ: FaelligkeitEreignisTyp
  datum?: string
  notiz?: string | null
  updateLetzteErledigung?: boolean
  bezug_datum?: string | null
  gueltig_bis?: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
    const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const view = await getFaelligkeitHistorieView(db, id, limit, offset)
    if (!view) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: view })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const body = (await request.json()) as HistorieBody

    if (!body.ereignis_typ) {
      return NextResponse.json({ error: 'ereignis_typ erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const exists = await getFaelligkeit(db, id)
    if (!exists) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const entry = await addFaelligkeitHistorie(db, {
      faelligkeit_id: id,
      ereignis_typ: body.ereignis_typ,
      datum: body.datum,
      user_id: auth.userContext.userId,
      notiz: body.notiz,
      updateLetzteErledigung: body.updateLetzteErledigung,
      bezug_datum: body.bezug_datum,
      gueltig_bis: body.gueltig_bis,
    })
    if (!entry) {
      return NextResponse.json({ error: 'Historie konnte nicht gespeichert werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: entry })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
