import { NextRequest, NextResponse } from 'next/server'
import { getDB, createChecklisteEintrag, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function POST(
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
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const kategorieId = typeof o.kategorieId === 'string' ? o.kategorieId : ''
    const text = typeof o.text === 'string' ? o.text.trim() : ''
    if (!kategorieId || !text) {
      return NextResponse.json({ error: 'kategorieId und text sind erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const eid = await createChecklisteEintrag(db, checklistId, kategorieId, text)
    if (!eid) {
      return NextResponse.json({ error: 'Eintrag konnte nicht angelegt werden' }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: eid }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
