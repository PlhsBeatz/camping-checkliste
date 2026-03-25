import { NextRequest, NextResponse } from 'next/server'
import { getDB, resetChecklisteErledigt, CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const ok = await resetChecklisteErledigt(db, id)
    if (!ok) {
      return NextResponse.json({ error: 'Zurücksetzen fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
