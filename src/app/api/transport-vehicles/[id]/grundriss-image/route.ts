import { NextRequest, NextResponse } from 'next/server'
import { getCampingPhotosR2, getDB, getTransportVehicleById, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

type RouteParams = { params: Promise<{ id: string }> }

/** GET /api/transport-vehicles/[id]/grundriss-image */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const vehicle = await getTransportVehicleById(db, id)
    if (!vehicle?.grundriss_bild_r2_key) {
      return NextResponse.json({ error: 'Kein Grundriss-Bild' }, { status: 404 })
    }

    const bucket = await getCampingPhotosR2(env)
    if (!bucket) {
      return NextResponse.json({ error: 'R2 nicht verfügbar' }, { status: 503 })
    }

    const obj = await bucket.get(vehicle.grundriss_bild_r2_key)
    if (!obj) {
      return NextResponse.json({ error: 'Datei fehlt' }, { status: 404 })
    }

    const contentType =
      obj.httpMetadata?.contentType ||
      vehicle.grundriss_bild_content_type ||
      'image/webp'
    const arr = await obj.arrayBuffer()
    return new NextResponse(arr, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
