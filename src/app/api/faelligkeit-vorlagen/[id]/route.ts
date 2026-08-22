import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  updateFaelligkeitVorlage,
  deleteFaelligkeitVorlage,
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await context.params
    const body = (await request.json()) as FaelligkeitVorlageBody
    if (body.name !== undefined && !body.name.trim()) {
      return NextResponse.json({ error: 'name darf nicht leer sein' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const updated = await updateFaelligkeitVorlage(db, id, {
      name: body.name?.trim(),
      kategorie: body.kategorie,
      typ: body.typ ? normalizeFaelligkeitTyp(body.typ) : undefined,
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
    if (!updated) {
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await context.params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await deleteFaelligkeitVorlage(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
