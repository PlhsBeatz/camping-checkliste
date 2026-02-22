import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  togglePackingItemForMitreisender,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as {
      packingItemId?: string
      mitreisenderId?: string
      gepackt?: boolean
    }
    const { packingItemId, mitreisenderId, gepackt } = body

    if (!packingItemId || !mitreisenderId || gepackt === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      if (!canAccessVacation(auth.userContext, mitreisende.map(m => m.id))) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }
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
