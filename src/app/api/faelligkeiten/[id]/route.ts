import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getFaelligkeit,
  updateFaelligkeit,
  deleteFaelligkeit,
  type CloudflareEnv,
  type FaelligkeitKategorie,
  type FaelligkeitTyp,
  type FaelligkeitIntervallEinheit,
  type FaelligkeitIntervallRhythmus,
} from '@/lib/db'
import { requireAuth, requireWriteWartung, requireReadWartung } from '@/lib/api-auth'

interface FaelligkeitUpdateBody {
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
  is_archived?: boolean
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
    const item = await getFaelligkeit(db, id)
    if (!item) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireWriteWartung(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await params
    const body = (await request.json()) as FaelligkeitUpdateBody
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await updateFaelligkeit(db, id, body)
    if (!item) {
      return NextResponse.json({ error: 'Nicht gefunden oder Update fehlgeschlagen' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: item })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireWriteWartung(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await deleteFaelligkeit(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
