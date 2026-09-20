import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMessung,
  createVerbrauchEreignis,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireWriteWartung, requireReadWartung } from '@/lib/api-auth'

interface EreignisBody {
  menge?: number
  datum?: string | null
  notizen?: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const readErr = requireReadWartung(auth.userContext)
    if (readErr) return readErr

    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const messung = await getVerbrauchMessung(db, id)
    if (!messung) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: messung.ereignisse ?? [] })
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
    const writeErr = requireWriteWartung(auth.userContext)
    if (writeErr) return writeErr

    const { id } = await params
    const body = (await request.json()) as EreignisBody
    if (body.menge == null || !(Number(body.menge) > 0)) {
      return NextResponse.json({ error: 'menge muss > 0 sein' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await createVerbrauchEreignis(db, {
      messung_id: id,
      menge: Number(body.menge),
      datum: body.datum ?? null,
      notizen: body.notizen ?? null,
    })
    if (!item) {
      return NextResponse.json({ error: 'Ereignis konnte nicht gespeichert werden' }, { status: 400 })
    }
    const messung = await getVerbrauchMessung(db, id)
    return NextResponse.json({ success: true, data: { ereignis: item, messung } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
