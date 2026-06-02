import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVacation,
  getPackingItems,
  getVacations,
  type CloudflareEnv,
} from '@/lib/db'
import { requireIntegrationAuth } from '@/lib/integration-auth'
import { buildTripStatusPayload, findRelevantVacation } from '@/lib/trip-readiness'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireIntegrationAuth(request)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    let vacation = vacationId ? await getVacation(db, vacationId) : null
    if (!vacation && !vacationId) {
      const all = await getVacations(db)
      vacation = findRelevantVacation(all)
    }

    if (!vacation) {
      return NextResponse.json({ error: 'Kein relevanter Urlaub gefunden' }, { status: 404 })
    }

    const items = await getPackingItems(db, vacation.id)
    const data = buildTripStatusPayload(vacation, items)

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
