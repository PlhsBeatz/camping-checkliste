import { NextRequest, NextResponse } from 'next/server'
import { getDB, reorderChecklisteEintraege, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

function isReorderItem(x: unknown): x is { id: string; kategorie_id: string; reihenfolge: number } {
  if (x === null || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === 'string' &&
    typeof o.kategorie_id === 'string' &&
    typeof o.reihenfolge === 'number' &&
    Number.isFinite(o.reihenfolge)
  )
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
    const { id: checklistId } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const raw =
      body &&
      typeof body === 'object' &&
      Array.isArray((body as { updates?: unknown }).updates)
        ? (body as { updates: unknown[] }).updates
        : null
    if (!raw || raw.length === 0) {
      return NextResponse.json({ error: 'updates[] erforderlich' }, { status: 400 })
    }
    const updates = raw.filter(isReorderItem)
    if (updates.length !== raw.length) {
      return NextResponse.json({ error: 'Ungültiges updates-Format' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const ok = await reorderChecklisteEintraege(db, checklistId, updates)
    if (!ok) {
      return NextResponse.json({ error: 'Sortierung fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
