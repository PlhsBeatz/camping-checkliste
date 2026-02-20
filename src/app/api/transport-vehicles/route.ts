import { NextRequest, NextResponse } from 'next/server'
import {
  getTransportVehiclesWithFestgewicht,
  createTransportVehicle,
  updateTransportVehicle,
  deleteTransportVehicle,
  getDB
} from '@/lib/db'
import type { CloudflareEnv } from '@/lib/db'

export async function GET(_request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const vehicles = await getTransportVehiclesWithFestgewicht(db)

    return NextResponse.json({
      success: true,
      data: vehicles
    })
  } catch (error) {
    console.error('Error fetching transport vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transport vehicles'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/transport-vehicles
 * Erstellen eines neuen Transportmittels
 */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as {
      name?: string
      zulGesamtgewicht?: number
      zul_gesamtgewicht?: number
      eigengewicht?: number
      festInstalliertMitrechnen?: boolean
    }
    const name = body.name
    const zulGesamtgewicht = body.zulGesamtgewicht ?? body.zul_gesamtgewicht
    const eigengewicht = body.eigengewicht
    const festInstalliertMitrechnen = body.festInstalliertMitrechnen ?? false

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'Name ist erforderlich' }, { status: 400 })
    }
    if (zulGesamtgewicht === undefined || zulGesamtgewicht === null || zulGesamtgewicht <= 0) {
      return NextResponse.json(
        { success: false, error: 'Zulässiges Gesamtgewicht muss größer als 0 sein' },
        { status: 400 }
      )
    }
    if (eigengewicht === undefined || eigengewicht === null || eigengewicht < 0) {
      return NextResponse.json(
        { success: false, error: 'Eigengewicht muss 0 oder größer sein' },
        { status: 400 }
      )
    }

    const id = await createTransportVehicle(
      db,
      name.trim(),
      zulGesamtgewicht,
      eigengewicht,
      festInstalliertMitrechnen
    )
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehler beim Erstellen' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Error in POST /api/transport-vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Erstellen'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/transport-vehicles
 * Aktualisieren eines Transportmittels
 */
export async function PUT(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as {
      id?: string
      name?: string
      zulGesamtgewicht?: number
      zul_gesamtgewicht?: number
      eigengewicht?: number
      festInstalliertMitrechnen?: boolean
    }
    const { id, name, zulGesamtgewicht, zul_gesamtgewicht, eigengewicht, festInstalliertMitrechnen } =
      body

    if (!id || !name?.trim()) {
      return NextResponse.json({ success: false, error: 'ID und Name sind erforderlich' }, { status: 400 })
    }
    const zul = zulGesamtgewicht ?? zul_gesamtgewicht
    if (zul === undefined || zul === null || zul <= 0) {
      return NextResponse.json(
        { success: false, error: 'Zulässiges Gesamtgewicht muss größer als 0 sein' },
        { status: 400 }
      )
    }
    if (eigengewicht === undefined || eigengewicht === null || eigengewicht < 0) {
      return NextResponse.json(
        { success: false, error: 'Eigengewicht muss 0 oder größer sein' },
        { status: 400 }
      )
    }

    const success = await updateTransportVehicle(
      db,
      id,
      name.trim(),
      zul,
      eigengewicht,
      festInstalliertMitrechnen
    )
    if (!success) {
      return NextResponse.json({ success: false, error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/transport-vehicles:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fehler beim Aktualisieren'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/transport-vehicles
 * Löschen eines Transportmittels
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

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
        error: error instanceof Error ? error.message : 'Fehler beim Löschen'
      },
      { status: 500 }
    )
  }
}
