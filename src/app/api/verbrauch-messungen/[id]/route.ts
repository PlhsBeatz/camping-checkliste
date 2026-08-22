import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMessung,
  updateVerbrauchMessung,
  deleteVerbrauchMessung,
  type CloudflareEnv,
  type VerbrauchMessungTyp,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

interface VerbrauchUpdateBody {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await getVerbrauchMessung(db, id)
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
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await params
    const body = (await request.json()) as VerbrauchUpdateBody
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const item = await updateVerbrauchMessung(db, id, body)
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
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await deleteVerbrauchMessung(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
