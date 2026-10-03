import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getVacation,
  getVacationTransports,
  setVacationTransports,
  setMitreisendeForVacation,
  getMitreisendeForVacation,
  ensureVacationTransportDefaults,
  getTransportVehicles,
  getTransportGruppeIdsForVacation,
  type CloudflareEnv,
} from '@/lib/db'
import { filterVehiclesByGruppeIds } from '@/lib/pauschal-gruppen'
import { requireAuth } from '@/lib/api-auth'
import { defaultTransportIdsForDate, vacationActivityDate } from '@/lib/transport-types'

/**
 * GET /api/vacations/transports?vacationId=
 * Nur lesen – keine Defaults/Prune-Writes (Defaults: Create-Urlaub / PUT mit ensureDefaults).
 *
 * PUT body: { vacationId, transportIds?, sitzTransportByMitreisender?, ensureDefaults? }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const vacationId = new URL(request.url).searchParams.get('vacationId')
    if (!vacationId) {
      return NextResponse.json({ success: false, error: 'vacationId erforderlich' }, { status: 400 })
    }
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vacation = await getVacation(db, vacationId)
    if (!vacation) {
      return NextResponse.json({ success: false, error: 'Urlaub nicht gefunden' }, { status: 404 })
    }

    const [transports, allVehicles, gruppeIds, mitreisende] = await Promise.all([
      getVacationTransports(db, vacationId),
      getTransportVehicles(db),
      getTransportGruppeIdsForVacation(db, vacationId),
      getMitreisendeForVacation(db, vacationId),
    ])

    const eligible = filterVehiclesByGruppeIds(allVehicles, gruppeIds)
    const eligibleIds = new Set(eligible.map((v) => v.id))
    const filteredTransports = transports.filter((t) => eligibleIds.has(t.id))
    const suggestedIds = defaultTransportIdsForDate(
      eligible,
      vacationActivityDate(vacation)
    )

    return NextResponse.json({
      success: true,
      data: {
        transportIds: filteredTransports.map((t) => t.id),
        transports: filteredTransports,
        suggestedIds,
        allVehicles: eligible,
        mitreisendeSitz: Object.fromEntries(
          mitreisende.map((m) => [m.id, m.sitz_transport_id ?? null])
        ),
        needsPrune: filteredTransports.length !== transports.length,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/vacations/transports:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      transportIds?: string[]
      sitzTransportByMitreisender?: Record<string, string | null>
      ensureDefaults?: boolean
    }
    const vacationId = body.vacationId
    if (!vacationId) {
      return NextResponse.json({ success: false, error: 'vacationId erforderlich' }, { status: 400 })
    }
    const vacation = await getVacation(db, vacationId)
    if (!vacation) {
      return NextResponse.json({ success: false, error: 'Urlaub nicht gefunden' }, { status: 404 })
    }

    const [allVehicles, gruppeIds] = await Promise.all([
      getTransportVehicles(db),
      getTransportGruppeIdsForVacation(db, vacationId),
    ])
    const eligible = filterVehiclesByGruppeIds(allVehicles, gruppeIds)
    const allowed = new Set(eligible.map((v) => v.id))

    let filteredIds: string[]
    if (Array.isArray(body.transportIds)) {
      filteredIds = body.transportIds.filter((id) => allowed.has(id))
    } else if (body.ensureDefaults) {
      filteredIds = await ensureVacationTransportDefaults(
        db,
        vacationId,
        vacation.startdatum,
        vacation.abfahrtdatum
      )
      // ensure schreibt nur bei leerer Auswahl; gefilterte IDs zurückgeben
      filteredIds = filteredIds.filter((id) => allowed.has(id))
    } else {
      return NextResponse.json(
        { success: false, error: 'transportIds oder ensureDefaults erforderlich' },
        { status: 400 }
      )
    }

    // Explizit leere Liste + ensureDefaults → Standards setzen
    if (filteredIds.length === 0 && body.ensureDefaults) {
      filteredIds = defaultTransportIdsForDate(
        eligible,
        vacationActivityDate(vacation)
      ).filter((id) => allowed.has(id))
    }

    const ok = await setVacationTransports(db, vacationId, filteredIds)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Speichern fehlgeschlagen' }, { status: 500 })
    }

    if (body.sitzTransportByMitreisender) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      const ids = mitreisende.map((m) => m.id)
      await setMitreisendeForVacation(db, vacationId, ids, body.sitzTransportByMitreisender)
    }

    return NextResponse.json({
      success: true,
      data: { transportIds: filteredIds },
    })
  } catch (error) {
    console.error('Error in PUT /api/vacations/transports:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler',
      },
      { status: 500 }
    )
  }
}
