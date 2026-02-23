import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getPackingItems,
  updatePackingItem,
  addPackingItem,
  addTemporaryPackingItem,
  deletePackingItem,
  getPacklisteId,
  getVacationIdFromPackingItem,
  getMitreisendeForVacation,
  getPackingItemPauschalVorgemerkt,
  CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'
import { requireAuth } from '@/lib/api-auth'
import { canAccessVacation, gepacktRequiresParentApproval } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')

    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId is required' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const mitreisende = await getMitreisendeForVacation(db, vacationId)
    const ids = mitreisende.map(m => m.id)
    if (!canAccessVacation(auth.userContext, ids)) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }
    const items = await getPackingItems(db, vacationId)

    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      gegenstandId?: string
      anzahl?: number
      bemerkung?: string | null
      transportId?: string | null
      mitreisende?: string[]
      temporary?: boolean
      was?: string
      kategorieId?: string
    }
    const { vacationId, gegenstandId, anzahl, bemerkung, transportId, mitreisende, temporary, was, kategorieId } = body

    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId is required' }, { status: 400 })
    }

    const vacationMitreisende = await getMitreisendeForVacation(db, vacationId)
    if (!canAccessVacation(auth.userContext, vacationMitreisende.map(m => m.id))) {
      return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
    }

    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Packliste not found' }, { status: 404 })
    }

    let itemId: string | null

    if (temporary && was != null && was.trim() !== '' && kategorieId) {
      itemId = await addTemporaryPackingItem(
        db,
        packlisteId,
        was.trim(),
        kategorieId,
        anzahl ?? 1,
        bemerkung,
        transportId
      )
    } else if (gegenstandId) {
      itemId = await addPackingItem(db, packlisteId, gegenstandId, anzahl || 1, bemerkung, transportId, mitreisende)
    } else {
      return NextResponse.json({ error: 'gegenstandId or (temporary, was, kategorieId) required' }, { status: 400 })
    }

    if (!itemId) {
      return NextResponse.json({ error: 'Failed to add packing item' }, { status: 400 })
    }

    const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as {
      id?: string
      gepackt?: boolean
      anzahl?: number
      bemerkung?: string | null
      transport_id?: string | null
    }
    const { id, gepackt, anzahl, bemerkung, transport_id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const vacationId = await getVacationIdFromPackingItem(db, id)
    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      if (!canAccessVacation(auth.userContext, mitreisende.map(m => m.id))) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }
    }

    const updates: { gepackt?: boolean; gepackt_vorgemerkt?: boolean; gepackt_vorgemerkt_durch?: string | null; anzahl?: number; bemerkung?: string | null; transport_id?: string | null } = {
      anzahl,
      bemerkung,
      transport_id: transport_id ?? undefined,
    }
    if (gepackt !== undefined) {
      if (gepacktRequiresParentApproval(auth.userContext)) {
        if (!gepackt) {
          const current = await getPackingItemPauschalVorgemerkt(db, id)
          if (current?.gepackt_vorgemerkt && current.gepackt_vorgemerkt_durch !== auth.userContext.mitreisenderId) {
            return NextResponse.json(
              { error: 'Nur die eigene Vormerkung kann entfernt werden' },
              { status: 403 }
            )
          }
        }
        updates.gepackt_vorgemerkt = gepackt
        updates.gepackt_vorgemerkt_durch = gepackt ? (auth.userContext.mitreisenderId ?? null) : null
      } else {
        updates.gepackt = gepackt
        // Admin: Beim Abhaken auch Vormerkung zurücksetzen
        if (!gepackt) {
          updates.gepackt_vorgemerkt = false
          updates.gepackt_vorgemerkt_durch = null
        }
      }
    }
    const success = await updatePackingItem(db, id, updates)

    if (success && vacationId) {
      const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
    }

    return NextResponse.json({ success: true, data: success })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const vacationId = await getVacationIdFromPackingItem(db, id)
    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      if (!canAccessVacation(auth.userContext, mitreisende.map(m => m.id))) {
        return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
      }
    }
    const success = await deletePackingItem(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete packing item' }, { status: 400 })
    }

    if (vacationId) {
      const env = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(env, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
