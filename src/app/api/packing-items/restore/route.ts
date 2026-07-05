import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getPacklisteId,
  getMitreisendeForVacation,
  restorePackingItemFromSnapshot,
  type CloudflareEnv,
  type PackingItem,
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
      vacationId?: string
      item?: Partial<PackingItem> & { id: string; anzahl: number }
    }

    const { vacationId, item } = body
    if (!vacationId || !item?.id) {
      return NextResponse.json({ error: 'vacationId and item.id required' }, { status: 400 })
    }

    const vacationMitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, vacationMitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Packliste not found' }, { status: 404 })
    }

    const success = await restorePackingItemFromSnapshot(db, packlisteId, item)
    if (!success) {
      return NextResponse.json({ error: 'Wiederherstellen fehlgeschlagen' }, { status: 400 })
    }

    const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)
    await notifyIntegrationChange(cfEnv, vacationId)

    return NextResponse.json({ success: true, data: { id: item.id } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
