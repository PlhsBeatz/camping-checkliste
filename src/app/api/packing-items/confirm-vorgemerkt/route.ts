import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  confirmVorgemerktPauschal,
  confirmVorgemerktForMitreisender,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminCheck = requireAdmin(auth.userContext)
    if (adminCheck) return adminCheck

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as {
      packingItemId: string
      mitreisenderId?: string
    }
    const { packingItemId, mitreisenderId } = body

    if (!packingItemId) {
      return NextResponse.json(
        { success: false, error: 'packingItemId erforderlich' },
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

    let success: boolean
    if (mitreisenderId) {
      success = await confirmVorgemerktForMitreisender(db, packingItemId, mitreisenderId)
    } else {
      success = await confirmVorgemerktPauschal(db, packingItemId)
    }

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Keine vorgemerkten Einträge gefunden' },
        { status: 400 }
      )
    }

    if (vacationId) {
      const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error confirming vorgemerkt:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
