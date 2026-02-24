import { NextRequest, NextResponse } from 'next/server'
import { CloudflareEnv, getDB, getUserById, getCampingplatzById } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { calculateRouteWithCaching } from '@/lib/routes'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as { campingplatzId?: string }
    if (!body.campingplatzId) {
      return NextResponse.json(
        { success: false, error: 'campingplatzId is required' },
        { status: 400 }
      )
    }

    const user = await getUserById(db, userContext.userId)
    if (!user || user.heimat_lat == null || user.heimat_lng == null) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Keine gültige Heimatadresse mit Koordinaten hinterlegt. Bitte im Profil eine Heimatadresse setzen.',
        },
        { status: 400 }
      )
    }

    const campingplatz = await getCampingplatzById(db, body.campingplatzId)
    if (!campingplatz) {
      return NextResponse.json(
        { success: false, error: 'Campingplatz nicht gefunden' },
        { status: 404 }
      )
    }

    const entry = await calculateRouteWithCaching({
      db,
      userId: userContext.userId,
      campingplatz,
      userLat: user.heimat_lat ?? 0,
      userLng: user.heimat_lng ?? 0,
    })

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

