import { NextRequest, NextResponse } from 'next/server'
import {
  getTransportVehiclesWithFestgewicht,
  createTransportVehicle,
  updateTransportVehicle,
  deleteTransportVehicle,
  replaceTransportVehicle,
  isTransportVehicleInUse,
  inactivateTransportVehicle,
  getDB,
  mitreisendenGruppeExists,
  type TransportVehicleInput,
} from '@/lib/db'
import type { CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { isAnbau, isFahrzeugtyp, zulGesamtgewichtForAnbau } from '@/lib/transport-types'

function parseTransportBody(body: Record<string, unknown>): TransportVehicleInput | { error: string } {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return { error: 'Name ist erforderlich' }

  const fahrzeugtyp =
    typeof body.fahrzeugtyp === 'string' && isFahrzeugtyp(body.fahrzeugtyp)
      ? body.fahrzeugtyp
      : undefined

  const eigengewicht = Number(body.eigengewicht)
  if (!Number.isFinite(eigengewicht) || eigengewicht < 0) {
    return { error: 'Eigengewicht muss 0 oder größer sein' }
  }

  let zulGesamtgewicht = Number(body.zulGesamtgewicht ?? body.zul_gesamtgewicht)
  let maxTraglast =
    body.maxTraglast != null || body.max_traglast != null
      ? Number(body.maxTraglast ?? body.max_traglast)
      : null

  if (fahrzeugtyp && isAnbau(fahrzeugtyp)) {
    if (maxTraglast == null || !Number.isFinite(maxTraglast) || maxTraglast <= 0) {
      return { error: 'Max. Traglast muss größer als 0 sein' }
    }
    zulGesamtgewicht = zulGesamtgewichtForAnbau(eigengewicht, maxTraglast)
  } else if (!Number.isFinite(zulGesamtgewicht) || zulGesamtgewicht <= 0) {
    return { error: 'Zulässiges Gesamtgewicht muss größer als 0 sein' }
  }

  const maxStuetzlastRaw = body.maxStuetzlast ?? body.max_stuetzlast
  const maxStuetzlast =
    maxStuetzlastRaw != null && maxStuetzlastRaw !== ''
      ? Number(maxStuetzlastRaw)
      : null

  const gruppeRaw = body.gruppeId ?? body.gruppe_id
  const gruppeId =
    typeof gruppeRaw === 'string' && gruppeRaw.trim()
      ? gruppeRaw.trim()
      : gruppeRaw === null
        ? null
        : undefined

  return {
    name,
    icon: typeof body.icon === 'string' ? body.icon : body.icon === null ? null : undefined,
    zulGesamtgewicht,
    eigengewicht,
    festInstalliertMitrechnen: !!(body.festInstalliertMitrechnen ?? body.fest_installiert_mitrechnen),
    fahrzeugtyp: fahrzeugtyp ?? null,
    hersteller: typeof body.hersteller === 'string' ? body.hersteller : null,
    modell: typeof body.modell === 'string' ? body.modell : null,
    maxStuetzlast:
      maxStuetzlast != null && Number.isFinite(maxStuetzlast) && maxStuetzlast > 0
        ? maxStuetzlast
        : null,
    maxTraglast:
      maxTraglast != null && Number.isFinite(maxTraglast) && maxTraglast > 0 ? maxTraglast : null,
    aktivVon:
      typeof body.aktivVon === 'string'
        ? body.aktivVon
        : typeof body.aktiv_von === 'string'
          ? body.aktiv_von
          : null,
    aktivBis:
      typeof body.aktivBis === 'string'
        ? body.aktivBis
        : typeof body.aktiv_bis === 'string'
          ? body.aktiv_bis
          : null,
    traegerTransportId:
      typeof body.traegerTransportId === 'string'
        ? body.traegerTransportId
        : typeof body.traeger_transport_id === 'string'
          ? body.traeger_transport_id
          : null,
    gruppeId,
    urlaubStandard: !!(body.urlaubStandard ?? body.urlaub_standard),
  }
}

/** Haushalt prüfen; Default wird einmalig in create/updateTransportVehicle gesetzt. */
async function validateGruppeIdForWrite(
  db: Awaited<ReturnType<typeof getDB>>,
  parsed: TransportVehicleInput
): Promise<{ error: string } | null> {
  if (!parsed.gruppeId) return null
  if (!(await mitreisendenGruppeExists(db, parsed.gruppeId))) {
    return { error: 'Haushalt nicht gefunden' }
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const usageId = new URL(request.url).searchParams.get('usageId')
    if (usageId) {
      const inUse = await isTransportVehicleInUse(db, usageId)
      return NextResponse.json({ success: true, data: { inUse } })
    }

    const vehicles = await getTransportVehiclesWithFestgewicht(db)

    return NextResponse.json({
      success: true,
      data: vehicles,
    })
  } catch (error) {
    console.error('Error fetching transport vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transport vehicles',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/transport-vehicles
 * Erstellen oder Ersetzen (body.replaceOfId + tauschdatum)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const body = (await request.json()) as Record<string, unknown>
    const parsed = parseTransportBody(body)
    if ('error' in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const gruppeErr = await validateGruppeIdForWrite(db, parsed)
    if (gruppeErr) {
      return NextResponse.json({ success: false, error: gruppeErr.error }, { status: 400 })
    }

    const replaceOfId =
      typeof body.replaceOfId === 'string'
        ? body.replaceOfId
        : typeof body.replace_of_id === 'string'
          ? body.replace_of_id
          : null
    const tauschdatum =
      typeof body.tauschdatum === 'string'
        ? body.tauschdatum
        : typeof body.swapDate === 'string'
          ? body.swapDate
          : null

    if (replaceOfId) {
      if (!tauschdatum?.trim()) {
        return NextResponse.json(
          { success: false, error: 'Tauschdatum ist erforderlich' },
          { status: 400 }
        )
      }
      const result = await replaceTransportVehicle(db, replaceOfId, tauschdatum.trim(), parsed)
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Fehler beim Ersetzen' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, data: { id: result.newId, replaced: replaceOfId } })
    }

    const id = await createTransportVehicle(db, parsed)
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehler beim Erstellen' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Error in POST /api/transport-vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Erstellen',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/transport-vehicles
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id : null
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID ist erforderlich' }, { status: 400 })
    }

    if (body.action === 'inactivate') {
      const ok = await inactivateTransportVehicle(db, id)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Fehler beim Inaktivieren' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, data: { inactivated: true } })
    }

    const parsed = parseTransportBody(body)
    if ('error' in parsed) {
      return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
    }

    const gruppeErr = await validateGruppeIdForWrite(db, parsed)
    if (gruppeErr) {
      return NextResponse.json({ success: false, error: gruppeErr.error }, { status: 400 })
    }

    const success = await updateTransportVehicle(db, id, parsed)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/transport-vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Aktualisieren',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/transport-vehicles
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID ist erforderlich' }, { status: 400 })
    }

    const success = await deleteTransportVehicle(db, id)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Fehler beim Löschen' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/transport-vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Löschen',
      },
      { status: 500 }
    )
  }
}
