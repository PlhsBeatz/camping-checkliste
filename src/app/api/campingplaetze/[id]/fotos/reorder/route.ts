import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getCampingplatzById, reorderCampingplatzFotos } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id: campingplatzId } = await context.params
    if (!campingplatzId) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const body = (await request.json()) as { orderedIds?: string[] }
    const orderedIds = body.orderedIds
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ success: false, error: 'orderedIds erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const cp = await getCampingplatzById(db, campingplatzId)
    if (!cp) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const ok = await reorderCampingplatzFotos(db, campingplatzId, orderedIds)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Sortierung fehlgeschlagen' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
