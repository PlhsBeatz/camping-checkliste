import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getMitreisendeForVacation,
  getVacationIdFromPackingItem,
  removeMitreisenderFromPackingItem,
  type CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

const MAX_BATCH_SIZE = 40

type PersonRemoval = {
  packingItemId: string
  mitreisenderId: string
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      removals?: PersonRemoval[]
    }

    const { vacationId, removals } = body
    if (!vacationId || !Array.isArray(removals) || removals.length === 0) {
      return NextResponse.json(
        { error: 'vacationId and removals required' },
        { status: 400 }
      )
    }
    if (removals.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH_SIZE} Entfernungen pro Anfrage` },
        { status: 400 }
      )
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    let removed = 0
    let failed = 0

    for (const entry of removals) {
      const { packingItemId, mitreisenderId } = entry
      if (!packingItemId || !mitreisenderId) {
        failed += 1
        continue
      }
      const itemVacationId = await getVacationIdFromPackingItem(db, packingItemId)
      if (itemVacationId !== vacationId) {
        failed += 1
        continue
      }
      const success = await removeMitreisenderFromPackingItem(db, packingItemId, mitreisenderId)
      if (success) removed += 1
      else failed += 1
    }

    if (removed > 0) {
      const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
      await notifyIntegrationChange(cfEnv, vacationId)
    }

    return NextResponse.json({
      success: failed === 0,
      data: { removed, failed, total: removals.length },
    })
  } catch (error) {
    console.error('Error batch removing mitreisender:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
