import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  setPauschalGruppenAssignment,
  getMitreisendeForVacation,
  type PauschalGruppenModus,
  type SetPauschalGruppenInput,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation, canEditPauschalEntries } from '@/lib/permissions'
import { getVacationGruppeIds } from '@/lib/pauschal-gruppen'

const MAX_BATCH_SIZE = 40

type BatchAssignment = {
  packingItemId?: string
  pauschalGruppenModus?: PauschalGruppenModus
  verantwortlicheGruppeId?: string | null
  gruppeIds?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    if (!canEditPauschalEntries(auth.userContext)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      assignments?: BatchAssignment[]
    }

    const { vacationId, assignments } = body
    if (!vacationId || !Array.isArray(assignments) || assignments.length === 0) {
      return NextResponse.json({ error: 'vacationId and assignments required' }, { status: 400 })
    }
    if (assignments.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH_SIZE} Zuordnungen pro Anfrage` },
        { status: 400 }
      )
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const vacationGruppeIds = getVacationGruppeIds(mitreisende)
    let updated = 0
    let failed = 0

    for (const row of assignments) {
      const { packingItemId, pauschalGruppenModus, verantwortlicheGruppeId, gruppeIds } = row
      if (!packingItemId || !pauschalGruppenModus) {
        failed += 1
        continue
      }
      const input: SetPauschalGruppenInput = {
        pauschalGruppenModus,
        verantwortlicheGruppeId: verantwortlicheGruppeId ?? null,
        gruppeIds,
      }
      const success = await setPauschalGruppenAssignment(
        db,
        packingItemId,
        input,
        vacationGruppeIds
      )
      if (success) updated += 1
      else failed += 1
    }

    if (updated > 0) {
      const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
      await notifyIntegrationChange(cfEnv, vacationId)
    }

    return NextResponse.json({
      success: failed === 0,
      data: { updated, failed, total: assignments.length },
    })
  } catch (error) {
    console.error('Error batch setting pauschal gruppen:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
