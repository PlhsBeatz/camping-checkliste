import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  setPauschalGruppenAssignment,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
  type PauschalGruppenModus,
  type SetPauschalGruppenInput,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation, canEditPauschalEntries } from '@/lib/permissions'
import { getVacationGruppeIds } from '@/lib/pauschal-gruppen'

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    if (!canEditPauschalEntries(auth.userContext)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      packingItemId?: string
      pauschalGruppenModus?: PauschalGruppenModus
      verantwortlicheGruppeId?: string | null
      gruppeIds?: string[]
    }

    const { packingItemId, pauschalGruppenModus, verantwortlicheGruppeId, gruppeIds } = body
    if (!packingItemId || !pauschalGruppenModus) {
      return NextResponse.json({ error: 'packingItemId and pauschalGruppenModus required' }, { status: 400 })
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (!vacationId) {
      return NextResponse.json({ error: 'Eintrag nicht gefunden' }, { status: 404 })
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const vacationGruppeIds = getVacationGruppeIds(mitreisende)
    const input: SetPauschalGruppenInput = {
      pauschalGruppenModus,
      verantwortlicheGruppeId: verantwortlicheGruppeId ?? null,
      gruppeIds,
    }

    const success = await setPauschalGruppenAssignment(db, packingItemId, input, vacationGruppeIds)
    if (!success) {
      return NextResponse.json({ error: 'Zuordnung fehlgeschlagen' }, { status: 500 })
    }

    const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)
    await notifyIntegrationChange(cfEnv, vacationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting pauschal gruppen:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
