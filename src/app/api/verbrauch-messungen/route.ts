import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMessungen,
  createVerbrauchMessung,
  type CloudflareEnv,
  type VerbrauchMessungTyp,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

interface VerbrauchBody {
  typ?: VerbrauchMessungTyp
  urlaub_id?: string | null
  equipment_id?: string | null
  transport_id?: string | null
  messdatum_start?: string | null
  messdatum_ende?: string | null
  wert_start?: number | null
  wert_ende?: number | null
  einheit?: string
  notizen?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const typ = searchParams.get('typ') as VerbrauchMessungTyp | null
    const urlaubId = searchParams.get('urlaubId')

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const items = await getVerbrauchMessungen(db, {
      typ: typ ?? undefined,
      urlaubId: urlaubId ?? undefined,
    })
    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as VerbrauchBody
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await createVerbrauchMessung(db, body)
    if (!item) {
      return NextResponse.json({ error: 'Messung konnte nicht gespeichert werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
