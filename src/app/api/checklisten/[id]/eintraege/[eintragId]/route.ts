import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  updateChecklisteEintrag,
  deleteChecklisteEintrag,
  setChecklisteEintragErledigt,
  CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eintragId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const { id: checklistId, eintragId } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const text = typeof o.text === 'string' ? o.text.trim() : undefined
    const kategorie_id = typeof o.kategorieId === 'string' ? o.kategorieId : undefined
    const reihenfolge = typeof o.reihenfolge === 'number' ? o.reihenfolge : undefined
    if (text === undefined && kategorie_id === undefined && reihenfolge === undefined) {
      return NextResponse.json({ error: 'text, kategorieId und/oder reihenfolge erwartet' }, { status: 400 })
    }
    if (text !== undefined && !text) {
      return NextResponse.json({ error: 'text darf nicht leer sein' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const ok = await updateChecklisteEintrag(db, checklistId, eintragId, {
      text,
      kategorie_id,
      reihenfolge,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eintragId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { id: checklistId, eintragId } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    if (typeof o.erledigt !== 'boolean') {
      return NextResponse.json({ error: 'erledigt (boolean) erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const ok = await setChecklisteEintragErledigt(db, checklistId, eintragId, o.erledigt)
    if (!ok) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; eintragId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const { id: checklistId, eintragId } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const ok = await deleteChecklisteEintrag(db, checklistId, eintragId)
    if (!ok) {
      return NextResponse.json({ error: 'Löschen fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
