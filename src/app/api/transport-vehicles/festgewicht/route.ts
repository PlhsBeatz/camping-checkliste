import { NextRequest, NextResponse } from 'next/server'
import {
  getTransportVehicleFestgewichtManuell,
  getEquipmentItemsFestInstalliertByTransport,
  getDB
} from '@/lib/db'
import type { CloudflareEnv } from '@/lib/db'

/**
 * GET /api/transport-vehicles/festgewicht?transportId=xxx
 * Liefert manuelle Festgewicht-Einträge und Ausrüstung "Fest Installiert" für ein Transportmittel
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transportId = searchParams.get('transportId')
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    if (!transportId) {
      return NextResponse.json({ success: false, error: 'transportId erforderlich' }, { status: 400 })
    }

    const [manuell, equipment] = await Promise.all([
      getTransportVehicleFestgewichtManuell(db, transportId),
      getEquipmentItemsFestInstalliertByTransport(db, transportId)
    ])

    const festInstalliertSum = equipment.reduce((sum, e) => sum + (e.gesamtgewicht ?? 0), 0)

    return NextResponse.json({
      success: true,
      data: {
        manuell,
        equipment,
        festInstalliertSum
      }
    })
  } catch (error) {
    console.error('Error in GET /api/transport-vehicles/festgewicht:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fehler' },
      { status: 500 }
    )
  }
}
