import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getFaelligkeitVorlagen,
  createFaelligkeitVorlage,
  type CloudflareEnv,
  type FaelligkeitKategorie,
  type FaelligkeitTyp,
  type FaelligkeitIntervallEinheit,
  type FaelligkeitIntervallRhythmus,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { normalizeFaelligkeitTyp } from '@/lib/faelligkeit-status'

interface FaelligkeitVorlageBody {
  name?: string
  kategorie?: FaelligkeitKategorie
  typ?: FaelligkeitTyp
  intervall_einheit?: FaelligkeitIntervallEinheit | null
  intervall_wert?: number | null
  intervall_rhythmus?: FaelligkeitIntervallRhythmus | null
  warnung_tage_vorher?: number
  sicherheitsrelevant?: boolean
  quittierung_erforderlich?: boolean
  notizen?: string | null
  hinweis?: string | null
  sort_order?: number
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const data = await getFaelligkeitVorlagen(db)
    return NextResponse.json({ success: true, data })
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

    const body = (await request.json()) as FaelligkeitVorlageBody
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
    }
    if (!body.typ) {
      return NextResponse.json({ error: 'typ ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const created = await createFaelligkeitVorlage(db, {
      name: body.name.trim(),
      kategorie: body.kategorie,
      typ: normalizeFaelligkeitTyp(body.typ),
      intervall_einheit: body.intervall_einheit,
      intervall_wert: body.intervall_wert,
      intervall_rhythmus: body.intervall_rhythmus,
      warnung_tage_vorher: body.warnung_tage_vorher,
      sicherheitsrelevant: body.sicherheitsrelevant,
      quittierung_erforderlich: body.quittierung_erforderlich,
      notizen: body.notizen,
      hinweis: body.hinweis,
      sort_order: body.sort_order,
    })
    if (!created) {
      return NextResponse.json({ error: 'Erstellen fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
