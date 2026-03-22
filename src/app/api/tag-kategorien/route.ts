import { NextRequest, NextResponse } from 'next/server'
import { getDB, getTagKategorien, updateTagKategorie, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const data = await getTagKategorien(db)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as { id?: string; titel?: string; reihenfolge?: number }
    const { id, titel, reihenfolge } = body

    if (!id || titel === undefined || titel === '' || reihenfolge === undefined) {
      return NextResponse.json({ error: 'id, titel und reihenfolge sind erforderlich' }, { status: 400 })
    }

    const success = await updateTagKategorie(db, id, titel, reihenfolge)
    if (!success) {
      return NextResponse.json({ error: 'Aktualisierung fehlgeschlagen' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
