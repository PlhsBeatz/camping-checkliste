import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, getPackingItems, type CloudflareEnv } from '@/lib/db'
import { requireIntegrationAuth } from '@/lib/integration-auth'
import { buildTripStatusPayload, findRelevantVacation } from '@/lib/trip-readiness'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireIntegrationAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vacations = await getVacations(db)

    const summaries = await Promise.all(
      vacations.map(async (v) => {
        const items = await getPackingItems(db, v.id)
        const status = buildTripStatusPayload(v, items)
        return {
          id: v.id,
          titel: v.titel,
          startdatum: v.startdatum,
          abfahrtdatum: v.abfahrtdatum ?? null,
          enddatum: v.enddatum,
          reiseziel_name: v.reiseziel_name,
          phase: status.phase,
          days_until_departure: status.days_until_departure,
          packing_percent: status.packing.percent,
          ready_to_depart: status.readiness.ready_to_depart,
        }
      })
    )

    const relevant = findRelevantVacation(vacations)

    return NextResponse.json({
      success: true,
      data: {
        schema_version: 1,
        relevant_vacation_id: relevant?.id ?? null,
        vacations: summaries,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
