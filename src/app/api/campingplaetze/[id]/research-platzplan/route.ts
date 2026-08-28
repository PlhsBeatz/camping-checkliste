import { NextRequest, NextResponse } from 'next/server'
import { getDB, getCampingplatzById, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { researchPlatzplanForCampingplatz } from '@/lib/platzplan-research'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id } = await context.params
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const cp = await getCampingplatzById(db, id)
    if (!cp) {
      return NextResponse.json({ success: false, error: 'Campingplatz nicht gefunden' }, { status: 404 })
    }
    const result = await researchPlatzplanForCampingplatz(db, id, {
      apiKey: env.OPENROUTER_API_KEY?.trim() ?? null,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
