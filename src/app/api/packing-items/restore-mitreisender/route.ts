import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getMitreisendeForVacation,
  getVacationIdFromPackingItem,
  restoreMitreisenderOnPackingItem,
  type CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      packingItemId?: string
      mitreisender?: {
        mitreisender_id?: string
        gepackt?: boolean
        gepackt_vorgemerkt?: boolean
        anzahl?: number | null
        transport_id?: string | null
        einzelgewicht_override?: number | null
      }
    }

    const { packingItemId, mitreisender } = body
    const mitreisenderId = mitreisender?.mitreisender_id
    if (!packingItemId || !mitreisenderId) {
      return NextResponse.json(
        { error: 'packingItemId and mitreisender.mitreisender_id required' },
        { status: 400 }
      )
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (!vacationId) {
      return NextResponse.json({ error: 'Packlisteneintrag nicht gefunden' }, { status: 404 })
    }

    const vacationMitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, vacationMitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const success = await restoreMitreisenderOnPackingItem(db, packingItemId, {
      ...mitreisender,
      mitreisender_id: mitreisenderId,
    })
    if (!success) {
      return NextResponse.json({ error: 'Wiederherstellen fehlgeschlagen' }, { status: 400 })
    }

    const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)
    await notifyIntegrationChange(cfEnv, vacationId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
