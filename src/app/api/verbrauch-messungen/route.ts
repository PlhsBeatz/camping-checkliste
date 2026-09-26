import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMessungen,
  createVerbrauchMessung,
  type CloudflareEnv,
  type VerbrauchMessungTyp,
} from '@/lib/db'
import { requireAuth, requireWriteWartung, requireReadWartung } from '@/lib/api-auth'
import { verbrauchUebersichtCutoffYmd } from '@/lib/verbrauch-uebersicht'

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
    const readErr = requireReadWartung(auth.userContext)
    if (readErr) return readErr
    const { searchParams } = new URL(request.url)
    const typ = searchParams.get('typ')
    const urlaubId = searchParams.get('urlaubId')
    const sinceParam = searchParams.get('since')
    const all = searchParams.get('all') === '1'
    const ereignisseParam = searchParams.get('ereignisse')
    const withEreignisse = ereignisseParam !== '0'

    const sinceYmd = all
      ? undefined
      : sinceParam && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam)
        ? sinceParam
        : verbrauchUebersichtCutoffYmd()

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const items = await getVerbrauchMessungen(db, {
      typ: typ ?? undefined,
      urlaubId: urlaubId ?? undefined,
      sinceYmd,
      withEreignisse,
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
    const adminErr = requireWriteWartung(auth.userContext)
    if (adminErr) return adminErr

    const body = (await request.json()) as VerbrauchBody
    if (!body.typ) {
      return NextResponse.json({ error: 'typ ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await createVerbrauchMessung(db, body)
    if (!item) {
      return NextResponse.json(
        { error: 'Messung konnte nicht gespeichert werden (Medium aktiv?)' },
        { status: 400 }
      )
    }
    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
