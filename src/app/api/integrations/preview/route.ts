import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVacation,
  getPackingItems,
  getVacations,
  type CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireSystemAdmin } from '@/lib/api-auth'
import {
  buildTripStatusPayload,
  computePackingProgress,
  findRelevantVacation,
  getDepartureDate,
} from '@/lib/trip-readiness'

const ENDPOINTS = ['trip-status', 'open-items', 'vacations'] as const
type PreviewEndpoint = (typeof ENDPOINTS)[number]

function isPreviewEndpoint(v: string | null): v is PreviewEndpoint {
  return v != null && (ENDPOINTS as readonly string[]).includes(v)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireSystemAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const vacationId = searchParams.get('vacationId')

    if (!isPreviewEndpoint(endpoint)) {
      return NextResponse.json(
        { error: 'endpoint muss trip-status, open-items oder vacations sein' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    if (endpoint === 'vacations') {
      const vacations = await getVacations(db)
      const summaries = await Promise.all(
        vacations.map(async (v) => {
          const items = await getPackingItems(db, v.id)
          const status = buildTripStatusPayload(v, items)
          return {
            id: v.id,
            titel: v.titel,
            phase: status.phase,
            days_until_departure: status.days_until_departure,
            packing_percent: status.packing.percent,
            ready_to_depart: status.readiness.ready_to_depart,
          }
        })
      )
      return NextResponse.json({
        success: true,
        data: {
          schema_version: 1,
          relevant_vacation_id: findRelevantVacation(vacations)?.id ?? null,
          vacations: summaries,
        },
      })
    }

    let vacation = vacationId ? await getVacation(db, vacationId) : null
    if (!vacation && !vacationId) {
      const all = await getVacations(db)
      vacation = findRelevantVacation(all)
    }
    if (!vacation) {
      return NextResponse.json({ error: 'Kein relevanter Urlaub gefunden' }, { status: 404 })
    }

    const items = await getPackingItems(db, vacation.id)

    if (endpoint === 'open-items') {
      const departureDate = getDepartureDate(vacation)
      const progress = computePackingProgress(items, departureDate)
      return NextResponse.json({
        success: true,
        data: {
          schema_version: 1,
          vacation_id: vacation.id,
          open_items: progress.openItems,
          open_items_count: progress.open_items_count,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: buildTripStatusPayload(vacation, items),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
