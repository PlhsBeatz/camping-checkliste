import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, getPackingItems, type CloudflareEnv } from '@/lib/db'
import { requireAuth, requireSystemAdmin } from '@/lib/api-auth'
import { buildTripStatusPayload, findRelevantVacation } from '@/lib/trip-readiness'
import { processIntegrationCron } from '@/lib/integration-events'
import { processOptimierungFaelligkeitPush } from '@/lib/optimierung-push-reminders'
import { processRestzahlungPush } from '@/lib/restzahlung-push-reminders'
import { processWartungFaelligkeitPush } from '@/lib/wartung-push-reminders'
import { refreshPackingPatternsAndSuggestions } from '@/lib/packing-patterns'
import {
  listCampingplaetzeForPlatzplanResearch,
  researchPlatzplanForCampingplatz,
} from '@/lib/platzplan-research'

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
    const optimierungPush = await processOptimierungFaelligkeitPush(db)
    const wartungPush = await processWartungFaelligkeitPush(db)
    const restzahlungPush = await processRestzahlungPush(db)
    const packingPatterns = await refreshPackingPatternsAndSuggestions(db, {
      apiKey: env.OPENROUTER_API_KEY?.trim() ?? null,
    })
    let platzplanJobs = 0
    try {
      const missingIds = await listCampingplaetzeForPlatzplanResearch(db, 4)
      for (const id of missingIds) {
        await researchPlatzplanForCampingplatz(db, id, {
          apiKey: env.OPENROUTER_API_KEY?.trim() ?? null,
        })
        platzplanJobs++
      }
    } catch (error) {
      console.error('Cron Platzplan-Suche:', error)
    }
    return NextResponse.json({
      success: true,
      data: {
        processed_vacations: processed,
        optimierung_reminders: optimierungPush,
        wartung_reminders: wartungPush,
        restzahlung_reminders: restzahlungPush,
        packing_patterns: packingPatterns,
        platzplan_jobs: platzplanJobs,
      },
    })
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
    const adminErr = requireSystemAdmin(auth.userContext)
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
