import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  removeMitreisenderFromPackingItem,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const packingItemId = searchParams.get('packingItemId')
    const mitreisenderId = searchParams.get('mitreisenderId')

    if (!packingItemId || !mitreisenderId) {
      return NextResponse.json(
        { success: false, error: 'packingItemId and mitreisenderId are required' },
        { status: 400 }
      )
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      if (!canAccessVacation(auth.userContext, mitreisende.map(m => m.id))) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }
    }

    const success = await removeMitreisenderFromPackingItem(db, packingItemId, mitreisenderId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to remove mitreisender' },
        { status: 500 }
      )
    }
    if (vacationId) {
      const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing mitreisender from packing item:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
