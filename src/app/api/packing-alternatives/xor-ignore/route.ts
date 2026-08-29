import { NextRequest, NextResponse } from 'next/server'
import { getDB, getMitreisendeForVacation, getPacklisteId, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'
import { ignoreXorGroupForPackliste, listXorIgnoredGroupIds } from '@/lib/packing-alternatives'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const vacationId = new URL(request.url).searchParams.get('vacationId')
    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const packlisteId = await getPacklisteId(db, vacationId)
    const ignoredGroupIds = packlisteId ? await listXorIgnoredGroupIds(db, packlisteId) : []
    return NextResponse.json({ success: true, data: { ignoredGroupIds } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }
    const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
    const vacationId = typeof o.vacationId === 'string' ? o.vacationId.trim() : ''
    const gruppeId = typeof o.gruppeId === 'string' ? o.gruppeId.trim() : ''
    if (!vacationId || !gruppeId) {
      return NextResponse.json(
        { error: 'vacationId und gruppeId sind erforderlich' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Keine Packliste für diesen Urlaub' }, { status: 404 })
    }

    const ok = await ignoreXorGroupForPackliste(db, packlisteId, gruppeId)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Ignorieren fehlgeschlagen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
