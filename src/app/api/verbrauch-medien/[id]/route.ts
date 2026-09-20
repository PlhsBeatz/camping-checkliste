import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMedium,
  updateVerbrauchMedium,
  deleteVerbrauchMedium,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireWriteWartung, requireReadWartung } from '@/lib/api-auth'
import type { VerbrauchMessmodus } from '@/lib/verbrauch-medien-katalog'

interface MedienUpdateBody {
  name?: string
  einheit?: string
  messmodus?: VerbrauchMessmodus
  label_wert_start?: string
  label_wert_ende?: string
  dichte_kg_pro_l?: number | null
  leergewicht_kg?: number | null
  ist_aktiv?: boolean
  sort_order?: number
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
    const item = await getVerbrauchMedium(db, id)
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
    const writeErr = requireWriteWartung(auth.userContext)
    if (writeErr) return writeErr

    const { id } = await params
    const body = (await request.json()) as MedienUpdateBody
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await updateVerbrauchMedium(db, id, body)
    if (!item) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
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
    const writeErr = requireWriteWartung(auth.userContext)
    if (writeErr) return writeErr

    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await deleteVerbrauchMedium(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
