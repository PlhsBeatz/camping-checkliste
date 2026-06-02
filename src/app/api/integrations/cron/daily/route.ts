import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, getPackingItems, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { buildTripStatusPayload, findRelevantVacation } from '@/lib/trip-readiness'
import { processIntegrationCron } from '@/lib/integration-events'

function verifyCronSecret(request: NextRequest): boolean {
  const expected = process.env.INTEGRATION_CRON_SECRET?.trim()
  if (!expected) return false
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${expected}`) return true
  const header = request.headers.get('x-cron-secret')
  return header === expected
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const processed = await processIntegrationCron(db)
    return NextResponse.json({ success: true, data: { processed_vacations: processed } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Admin: Live-Vorschau des Integrations-Status */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vacations = await getVacations(db)
    const vacation = findRelevantVacation(vacations)
    if (!vacation) {
      return NextResponse.json({ error: 'Kein relevanter Urlaub' }, { status: 404 })
    }
    const items = await getPackingItems(db, vacation.id)
    const data = buildTripStatusPayload(vacation, items)
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
