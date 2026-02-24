import { NextRequest, NextResponse } from 'next/server'
import { getDB, CloudflareEnv, getUserById, updateUserHomeLocation, deleteRoutesForUser } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const user = await getUserById(db, userContext.userId)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        heimat_adresse: user.heimat_adresse ?? null,
        heimat_lat: user.heimat_lat ?? null,
        heimat_lng: user.heimat_lng ?? null,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as {
      heimat_adresse?: string | null
      heimatAdresse?: string | null
      lat?: number | null
      lng?: number | null
    }

    const heimat_adresse = (body.heimat_adresse ?? body.heimatAdresse ?? '').trim()
    const lat = body.lat ?? null
    const lng = body.lng ?? null

    const success = await updateUserHomeLocation(db, userContext.userId, {
      heimat_adresse: heimat_adresse || null,
      heimat_lat: lat,
      heimat_lng: lng,
    })

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update home location' },
        { status: 500 }
      )
    }

    // Routen-Cache des Users invalidieren
    await deleteRoutesForUser(db, userContext.userId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

