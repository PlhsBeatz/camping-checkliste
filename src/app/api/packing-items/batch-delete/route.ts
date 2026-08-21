import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  deletePackingItemsBatch,
  getMitreisendeForVacation,
  getVacationIdsFromPackingItems,
  filterPackingItemIdsForVacation,
  type CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

const MAX_BATCH_SIZE = 40

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      itemIds?: string[]
    }

    const { vacationId, itemIds } = body
    if (!vacationId || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'vacationId and itemIds required' }, { status: 400 })
    }
    if (itemIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH_SIZE} Einträge pro Anfrage` },
        { status: 400 }
      )
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const vacationById = await getVacationIdsFromPackingItems(db, itemIds)
    const validIds = filterPackingItemIdsForVacation(vacationById, itemIds, vacationId)
    const failedLookup = itemIds.length - validIds.length

    const deleted = await deletePackingItemsBatch(db, validIds)
    const deletedCount = Math.min(deleted, validIds.length)
    const deleteFailed = validIds.length - deletedCount

    if (deletedCount > 0) {
      const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
      await notifyIntegrationChange(cfEnv, vacationId)
    }

    return NextResponse.json({
      success: failedLookup + deleteFailed === 0,
      data: {
        deleted: deletedCount,
        failed: failedLookup + deleteFailed,
        total: itemIds.length,
      },
    })
  } catch (error) {
    console.error('Error batch deleting packing items:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
