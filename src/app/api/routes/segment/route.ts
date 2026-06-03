import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getCampingplatzById } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { calculateSegmentRouteWithCaching } from '@/lib/routes'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const body = (await request.json()) as { fromId?: string; toId?: string }
    if (!body.fromId || !body.toId) {
      return NextResponse.json(
        { success: false, error: 'fromId und toId sind erforderlich' },
        { status: 400 }
      )
    }

    if (body.fromId === body.toId) {
      return NextResponse.json({
        success: true,
        data: { distanceKm: 0, durationMinutes: 0, provider: 'haversine' },
      })
    }

    const [from, to] = await Promise.all([
      getCampingplatzById(db, body.fromId),
      getCampingplatzById(db, body.toId),
    ])
    if (!from || !to) {
      return NextResponse.json(
        { success: false, error: 'Campingplatz nicht gefunden' },
        { status: 404 }
      )
    }

    const entry = await calculateSegmentRouteWithCaching({ db, from, to })
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Routenberechnung nicht möglich' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        distanceKm: entry.distance_km,
        durationMinutes: entry.duration_min,
        provider: entry.provider,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
