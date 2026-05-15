import { NextRequest, NextResponse } from 'next/server'
import { getDB, updateCheckliste, deleteCheckliste, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

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
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const titel = typeof o.titel === 'string' ? o.titel.trim() : undefined
    const reihenfolge = typeof o.reihenfolge === 'number' ? o.reihenfolge : undefined
    if (titel === undefined && reihenfolge === undefined) {
      return NextResponse.json({ error: 'titel und/oder reihenfolge erwartet' }, { status: 400 })
    }
    if (titel !== undefined && !titel) {
      return NextResponse.json({ error: 'titel darf nicht leer sein' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await updateCheckliste(db, id, { titel, reihenfolge })
    if (!ok) {
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
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
    const ok = await deleteCheckliste(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
