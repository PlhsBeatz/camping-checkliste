import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getMitreisendeForVacation,
  getVacationIdsFromPackingItems,
  filterPackingItemIdsForVacation,
  updatePackingItemsBatch,
  type CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

const MAX_BATCH_SIZE = 40

type BulkPatch = {
  transport_id?: string | null
  bemerkung?: string | null
  anzahl?: number
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      itemIds?: string[]
      patch?: BulkPatch
    }

    const { vacationId, itemIds, patch } = body
    if (!vacationId || !Array.isArray(itemIds) || itemIds.length === 0 || !patch) {
      return NextResponse.json(
        { error: 'vacationId, itemIds and patch required' },
        { status: 400 }
      )
    }
    if (itemIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH_SIZE} Einträge pro Anfrage` },
        { status: 400 }
      )
    }

    const patchKeys = Object.keys(patch) as (keyof BulkPatch)[]
    if (patchKeys.length === 0) {
      return NextResponse.json({ error: 'patch must contain at least one field' }, { status: 400 })
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const updates: BulkPatch = {}
    if ('transport_id' in patch) updates.transport_id = patch.transport_id ?? null
    if ('bemerkung' in patch) updates.bemerkung = patch.bemerkung ?? null
    if ('anzahl' in patch && patch.anzahl !== undefined) updates.anzahl = patch.anzahl

    const vacationById = await getVacationIdsFromPackingItems(db, itemIds)
    const validIds = filterPackingItemIdsForVacation(vacationById, itemIds, vacationId)
    const failed = itemIds.length - validIds.length

    const updated = await updatePackingItemsBatch(db, validIds, updates)
    // updatePackingItemsBatch zählt DB-changes (normal+temp); max. 1 pro ID erwartet
    const updatedCount = Math.min(updated, validIds.length)
    const updateFailed = validIds.length - updatedCount

    if (updatedCount > 0) {
      const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
      await notifyIntegrationChange(cfEnv, vacationId)
    }

    return NextResponse.json({
      success: failed + updateFailed === 0,
      data: {
        updated: updatedCount,
        failed: failed + updateFailed,
        total: itemIds.length,
      },
    })
  } catch (error) {
    console.error('Error batch updating packing items:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
