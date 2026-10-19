import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  togglePackingItemForMitreisender,
  togglePackingItemVorgemerktForMitreisender,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
} from '@/lib/db'
import { notifyPackingSyncChange, type PackingSyncPatchOp } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation, gepacktRequiresParentApproval } from '@/lib/permissions'

const MAX_BATCH = 20

/**
 * Mehrere Mitreisende eines Packlisten-Eintrags in einem Request abhaken.
 * Ein Sync-Broadcast + ein Integrations-Update statt N× Full-Scan.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const body = (await request.json()) as {
      packingItemId?: string
      updates?: Array<{ mitreisenderId?: string; gepackt?: boolean; anzahl?: number | null }>
    }
    const { packingItemId, updates } = body

    if (!packingItemId || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'packingItemId and updates required' },
        { status: 400 }
      )
    }
    if (updates.length > MAX_BATCH) {
      return NextResponse.json(
        { success: false, error: `Maximal ${MAX_BATCH} Updates pro Anfrage` },
        { status: 400 }
      )
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    let mitreisendeNames = new Map<string, string>()
    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }
      mitreisendeNames = new Map(mitreisende.map((m) => [m.id, m.name]))
    }

    const useVorgemerkt = gepacktRequiresParentApproval(auth.userContext)
    const patches: PackingSyncPatchOp[] = []
    let packedDelta = 0
    let failed = 0

    for (const u of updates) {
      if (!u.mitreisenderId || u.gepackt === undefined) {
        failed += 1
        continue
      }
      const ok = useVorgemerkt
        ? await togglePackingItemVorgemerktForMitreisender(
            db,
            packingItemId,
            u.mitreisenderId,
            u.gepackt
          )
        : await togglePackingItemForMitreisender(
            db,
            packingItemId,
            u.mitreisenderId,
            u.gepackt,
            u.anzahl
          )
      if (!ok) {
        failed += 1
        continue
      }
      if (useVorgemerkt) {
        patches.push({
          op: 'mitreisender-gepackt',
          id: packingItemId,
          mitreisenderId: u.mitreisenderId,
          gepackt: false,
          gepackt_vorgemerkt: u.gepackt,
          mitreisenderName: mitreisendeNames.get(u.mitreisenderId),
        })
      } else {
        patches.push({
          op: 'mitreisender-gepackt',
          id: packingItemId,
          mitreisenderId: u.mitreisenderId,
          gepackt: u.gepackt,
          mitreisenderName: mitreisendeNames.get(u.mitreisenderId),
        })
        packedDelta += u.gepackt ? 1 : -1
      }
    }

    if (vacationId && patches.length > 0) {
      const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId, {
        type: 'packing-patch',
        patches,
      })
      if (packedDelta !== 0) {
        await notifyIntegrationChange(cfEnv, vacationId, { packedDelta })
      }
    }

    return NextResponse.json({
      success: failed === 0,
      data: { updated: patches.length, failed, total: updates.length },
    })
  } catch (error) {
    console.error('Error batch toggling mitreisender status:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
