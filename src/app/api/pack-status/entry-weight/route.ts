import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getPackStatus,
  getMitreisendeForVacation,
  getVacationIdFromPackingItem,
  setPackEntryWeight,
  setPackEntryPersonWeight,
  clearPackEntryWeightOverride,
  type PackEntryWeightScope,
  CloudflareEnv,
} from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'

async function broadcastWeightChange(
  vacationId: string,
  options?: { equipmentChanged?: boolean }
): Promise<void> {
  try {
    const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)
    if (options?.equipmentChanged) {
      await notifyIntegrationChange(cfEnv, vacationId)
    }
  } catch (err) {
    console.warn('Weight change broadcast failed:', err)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const body = (await request.json()) as {
      packEntryId?: string
      weight?: number
      scope?: PackEntryWeightScope
      reset?: boolean
      mitreisenderId?: string
    }
    const { packEntryId, weight, scope, reset, mitreisenderId } = body

    if (!packEntryId) {
      return NextResponse.json({ error: 'packEntryId ist erforderlich' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const vacationId = await getVacationIdFromPackingItem(db, packEntryId)
    if (!vacationId) {
      return NextResponse.json({ error: 'Packlisteneintrag nicht gefunden' }, { status: 404 })
    }

    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    if (reset) {
      const ok = await clearPackEntryWeightOverride(db, packEntryId, mitreisenderId)
      if (!ok) {
        return NextResponse.json({ error: 'Gewicht konnte nicht zurückgesetzt werden' }, { status: 400 })
      }
      const data = await getPackStatus(db, vacationId)
      await broadcastWeightChange(vacationId)
      return NextResponse.json({ success: true, data: data ?? undefined })
    }

    if (mitreisenderId) {
      if (weight == null || weight <= 0) {
        return NextResponse.json({ error: 'weight (> 0) ist erforderlich' }, { status: 400 })
      }
      const ok = await setPackEntryPersonWeight(db, packEntryId, mitreisenderId, weight)
      if (!ok) {
        return NextResponse.json({ error: 'Gewicht konnte nicht gespeichert werden' }, { status: 400 })
      }
      const data = await getPackStatus(db, vacationId)
      await broadcastWeightChange(vacationId)
      return NextResponse.json({ success: true, data: data ?? undefined })
    }

    if (weight == null || weight <= 0) {
      return NextResponse.json({ error: 'weight (> 0) ist erforderlich' }, { status: 400 })
    }
    if (scope !== 'equipment' && scope !== 'packlist') {
      return NextResponse.json({ error: 'scope muss equipment oder packlist sein' }, { status: 400 })
    }

    const ok = await setPackEntryWeight(db, packEntryId, weight, scope)
    if (!ok) {
      return NextResponse.json({ error: 'Gewicht konnte nicht gespeichert werden' }, { status: 400 })
    }

    const data = await getPackStatus(db, vacationId)
    if (!data) {
      return NextResponse.json({ error: 'Pack-Status nicht gefunden' }, { status: 404 })
    }

    await broadcastWeightChange(vacationId, { equipmentChanged: scope === 'equipment' })
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
