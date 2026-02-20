import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  createTransportVehicleFestgewichtManuell,
  updateTransportVehicleFestgewichtManuell,
  deleteTransportVehicleFestgewichtManuell
} from '@/lib/db'
import type { CloudflareEnv } from '@/lib/db'

/**
 * POST /api/transport-vehicles/festgewicht-manuell
 * Erstellen eines manuellen Festgewicht-Eintrags
 */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as { transportId: string; titel: string; gewicht: number }

    const { transportId, titel, gewicht } = body
    if (!transportId || !titel?.trim()) {
      return NextResponse.json(
        { success: false, error: 'transportId und titel erforderlich' },
        { status: 400 }
      )
    }
    const w = typeof gewicht === 'number' ? gewicht : parseFloat(String(gewicht ?? 0))
    if (isNaN(w) || w < 0) {
      return NextResponse.json(
        { success: false, error: 'Gewicht muss >= 0 sein' },
        { status: 400 }
      )
    }

    const id = await createTransportVehicleFestgewichtManuell(db, transportId, titel.trim(), w)
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehler beim Erstellen' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Error in POST festgewicht-manuell:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fehler' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/transport-vehicles/festgewicht-manuell
 * Aktualisieren eines manuellen Festgewicht-Eintrags
 */
export async function PUT(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as { id: string; titel: string; gewicht: number }

    const { id, titel, gewicht } = body
    if (!id || !titel?.trim()) {
      return NextResponse.json({ success: false, error: 'id und titel erforderlich' }, { status: 400 })
    }
    const w = typeof gewicht === 'number' ? gewicht : parseFloat(String(gewicht ?? 0))
    if (isNaN(w) || w < 0) {
      return NextResponse.json(
        { success: false, error: 'Gewicht muss >= 0 sein' },
        { status: 400 }
      )
    }

    const success = await updateTransportVehicleFestgewichtManuell(db, id, titel.trim(), w)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Fehler beim Aktualisieren' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT festgewicht-manuell:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fehler' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/transport-vehicles/festgewicht-manuell?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    if (!id) {
      return NextResponse.json({ success: false, error: 'id erforderlich' }, { status: 400 })
    }

    const success = await deleteTransportVehicleFestgewichtManuell(db, id)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Fehler beim Löschen' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE festgewicht-manuell:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Fehler' },
      { status: 500 }
    )
  }
}
