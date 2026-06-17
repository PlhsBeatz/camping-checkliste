import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getMitreisendeForVacation,
  getVacationIdFromPackingItem,
  setMitreisenderAnzahl,
  type CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

const MAX_BATCH_SIZE = 40

type PersonUpdate = {
  packingItemId: string
  mitreisenderId: string
  anzahl: number
  transportId?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      updates?: PersonUpdate[]
    }

    const { vacationId, updates } = body
    if (!vacationId || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'vacationId and updates required' },
        { status: 400 }
      )
    }
    if (updates.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH_SIZE} Aktualisierungen pro Anfrage` },
        { status: 400 }
      )
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    let updated = 0
    let failed = 0

    for (const entry of updates) {
      const { packingItemId, mitreisenderId, anzahl, transportId } = entry
      if (!packingItemId || !mitreisenderId || anzahl === undefined || anzahl < 0) {
        failed += 1
        continue
      }
      const itemVacationId = await getVacationIdFromPackingItem(db, packingItemId)
      if (itemVacationId !== vacationId) {
        failed += 1
        continue
      }
      const success = await setMitreisenderAnzahl(
        db,
        packingItemId,
        mitreisenderId,
        anzahl,
        transportId
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
      data: { updated, failed, total: updates.length },
    })
  } catch (error) {
    console.error('Error batch setting mitreisender anzahl:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
