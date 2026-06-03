import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getVacations,
  getVacation,
  getCampingplaetzeForVacation,
  getCampingplaetzeForVacationsBatch,
  setCampingplaetzeForVacation,
  type CampingStayInput,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('urlaubId') || searchParams.get('vacationId')

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    if (!vacationId) {
      const mitreisenderFilter = userContext.role === 'gast' ? userContext.mitreisenderId : undefined
      const vacations = await getVacations(db, mitreisenderFilter)
      const ids = vacations.map((v) => v.id)
      const byVacation = await getCampingplaetzeForVacationsBatch(db, ids)
      return NextResponse.json({ success: true, data: byVacation })
    }

    const campingplaetze = await getCampingplaetzeForVacation(db, vacationId)
    return NextResponse.json({ success: true, data: campingplaetze })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const body = (await request.json()) as {
      urlaubId?: string
      vacationId?: string
      campingplatzIds?: string[]
      stays?: Array<{
        campingplatzId?: string
        campingplatz_id?: string
        startDatum?: string | null
        start_datum?: string | null
        endDatum?: string | null
        end_datum?: string | null
        notizen?: string | null
      }>
    }

    const vacationId = body.urlaubId || body.vacationId

    if (!vacationId) {
      return NextResponse.json(
        { success: false, error: 'urlaubId/vacationId is required' },
        { status: 400 }
      )
    }

    // Bevorzugt das neue Format mit Dauern; legacy `campingplatzIds` (ohne Datum) bleibt unterstützt.
    let stays: CampingStayInput[]
    if (Array.isArray(body.stays)) {
      stays = body.stays
        .map((s) => ({
          campingplatz_id: String(s.campingplatzId ?? s.campingplatz_id ?? ''),
          start_datum: s.startDatum ?? s.start_datum ?? null,
          end_datum: s.endDatum ?? s.end_datum ?? null,
          notizen: s.notizen ?? null,
        }))
        .filter((s) => s.campingplatz_id)
    } else {
      stays = (body.campingplatzIds ?? []).map((id) => ({ campingplatz_id: id }))
    }

    const ok = await setCampingplaetzeForVacation(db, vacationId, stays)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to set campingplaetze for vacation' },
        { status: 500 }
      )
    }

    const vacation = await getVacation(db, vacationId)
    return NextResponse.json({ success: true, data: { vacation } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

