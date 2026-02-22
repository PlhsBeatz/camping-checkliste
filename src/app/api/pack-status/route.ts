import { NextRequest, NextResponse } from 'next/server'
import { getDB, getPackStatus, getMitreisendeForVacation, CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')

    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId is required' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map(m => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
    const data = await getPackStatus(db, vacationId)

    if (!data) {
      return NextResponse.json({ error: 'Pack-Status nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
