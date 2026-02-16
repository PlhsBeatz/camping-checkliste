import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  togglePackingItemForMitreisender,
  getVacationIdFromPackingItem,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'

export async function PUT(request: Request) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = await request.json()
    const { packingItemId, mitreisenderId, gepackt } = body

    if (!packingItemId || !mitreisenderId || gepackt === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const success = await togglePackingItemForMitreisender(
      db,
      packingItemId,
      mitreisenderId,
      gepackt
    )

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update status' },
        { status: 500 }
      )
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (vacationId) {
      const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling mitreisender status:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
