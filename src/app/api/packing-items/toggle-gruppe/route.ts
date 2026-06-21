import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  togglePackingItemForGruppe,
  togglePackingItemVorgemerktForGruppe,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { notifyIntegrationChange } from '@/lib/integration-events'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation, canEditPauschalEntries, gepacktRequiresParentApproval } from '@/lib/permissions'
import { isAdminRole } from '@/lib/user-roles'
import { canToggleGruppeCheckbox } from '@/lib/pauschal-gruppen'

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    if (!canEditPauschalEntries(auth.userContext)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      packingItemId?: string
      gruppeId?: string
      gepackt?: boolean
    }
    const { packingItemId, gruppeId, gepackt } = body

    if (!packingItemId || !gruppeId || gepackt === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      if (!canAccessVacation(auth.userContext, mitreisende.map((m) => m.id))) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }
    }

    const isAdmin = isAdminRole(auth.userContext.role)
    if (!canToggleGruppeCheckbox(gruppeId, auth.userContext.gruppeId, isAdmin)) {
      return NextResponse.json({ error: 'Keine Berechtigung für diesen Haushalt' }, { status: 403 })
    }

    const useVorgemerkt = gepacktRequiresParentApproval(auth.userContext)
    const success = useVorgemerkt
      ? await togglePackingItemVorgemerktForGruppe(
          db,
          packingItemId,
          gruppeId,
          gepackt,
          auth.userContext.mitreisenderId
        )
      : await togglePackingItemForGruppe(db, packingItemId, gruppeId, gepackt)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    if (vacationId) {
      const cfEnv = (await getCloudflareContext({ async: true })).env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
      await notifyIntegrationChange(cfEnv, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling gruppe status:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
