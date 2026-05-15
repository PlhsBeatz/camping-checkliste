import { NextRequest, NextResponse } from 'next/server'
import { getDB, createChecklisteKategorie, CloudflareEnv } from '@/lib/db'
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
    const titel =
      body && typeof body === 'object' && typeof (body as { titel?: unknown }).titel === 'string'
        ? (body as { titel: string }).titel.trim()
        : ''
    if (!titel) {
      return NextResponse.json({ error: 'titel ist erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const kid = await createChecklisteKategorie(db, checklistId, titel)
    if (!kid) {
      return NextResponse.json({ error: 'Kategorie konnte nicht angelegt werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, id: kid }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
