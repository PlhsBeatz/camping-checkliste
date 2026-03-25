import { NextRequest, NextResponse } from 'next/server'
import { getDB, reorderChecklisteKategorien, CloudflareEnv } from '@/lib/db'
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
    const { id: checklistId } = await params
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const orderedIds =
      body &&
      typeof body === 'object' &&
      Array.isArray((body as { orderedIds?: unknown }).orderedIds)
        ? (body as { orderedIds: unknown[] }).orderedIds.filter((x): x is string => typeof x === 'string')
        : null
    if (!orderedIds || orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds (string[]) erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const ok = await reorderChecklisteKategorien(db, checklistId, orderedIds)
    if (!ok) {
      return NextResponse.json({ error: 'Sortierung fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
