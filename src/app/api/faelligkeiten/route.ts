import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getFaelligkeiten,
  createFaelligkeit,
  type CloudflareEnv,
  type FaelligkeitKategorie,
  type FaelligkeitTyp,
  type FaelligkeitIntervallEinheit,
  type FaelligkeitIntervallRhythmus,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

interface FaelligkeitBody {
  name?: string
  kategorie?: FaelligkeitKategorie
  typ?: FaelligkeitTyp
  equipment_id?: string | null
  transport_id?: string | null
  bezug_datum?: string | null
  gueltig_bis?: string | null
  letzte_erledigung_am?: string | null
  intervall_einheit?: FaelligkeitIntervallEinheit | null
  intervall_wert?: number | null
  intervall_rhythmus?: FaelligkeitIntervallRhythmus | null
  warnung_tage_vorher?: number
  sicherheitsrelevant?: boolean
  quittierung_erforderlich?: boolean
  notizen?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { searchParams } = new URL(request.url)
    const equipmentId = searchParams.get('equipmentId')
    const transportId = searchParams.get('transportId')
    const includeArchived = searchParams.get('includeArchived') === '1'

    const items = await getFaelligkeiten(db, {
      includeArchived,
      equipmentId: equipmentId ?? undefined,
      transportId: transportId ?? undefined,
    })
    const res = NextResponse.json({ success: true, data: items })
    res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
    return res
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

    const body = (await request.json()) as FaelligkeitBody
    if (!body.name?.trim() || !body.typ) {
      return NextResponse.json({ error: 'Name und Typ erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await createFaelligkeit(db, {
      name: body.name.trim(),
      kategorie: body.kategorie,
      typ: body.typ,
      equipment_id: body.equipment_id,
      transport_id: body.transport_id,
      bezug_datum: body.bezug_datum,
      gueltig_bis: body.gueltig_bis,
      letzte_erledigung_am: body.letzte_erledigung_am,
      intervall_einheit: body.intervall_einheit,
      intervall_wert: body.intervall_wert,
      intervall_rhythmus: body.intervall_rhythmus,
      warnung_tage_vorher: body.warnung_tage_vorher,
      sicherheitsrelevant: body.sicherheitsrelevant,
      quittierung_erforderlich: body.quittierung_erforderlich,
      notizen: body.notizen,
    })
    if (!item) {
      return NextResponse.json({ error: 'Fälligkeit konnte nicht angelegt werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
