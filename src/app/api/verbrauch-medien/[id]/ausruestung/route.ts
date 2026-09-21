import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVerbrauchMedium,
  getVerbrauchMedienAusruestungLinks,
  setVerbrauchMediumAusruestung,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireWriteWartung, requireReadWartung } from '@/lib/api-auth'

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
    const medium = await getVerbrauchMedium(db, id)
    if (!medium) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }
    const links = await getVerbrauchMedienAusruestungLinks(db, id)
    return NextResponse.json({ success: true, data: links })
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
    const body = (await request.json()) as { equipment_ids?: unknown }
    const equipmentIds = Array.isArray(body.equipment_ids)
      ? body.equipment_ids.filter((x): x is string => typeof x === 'string')
      : []

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const medium = await getVerbrauchMedium(db, id)
    if (!medium) {
      return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    }

    const links = await setVerbrauchMediumAusruestung(db, id, equipmentIds)
    return NextResponse.json({ success: true, data: links })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
