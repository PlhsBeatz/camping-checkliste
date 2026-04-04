import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { fetchPlacePhotosForPicker } from '@/lib/google-place-photos-merge'

/**
 * Liefert die Foto-Referenzen für eine Google-Place-ID (Places API New, dedupliziert).
 * Google liefert höchstens 10 Fotos pro Place-Details-Antwort.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const placeId = request.nextUrl.searchParams.get('placeId')?.trim()
    if (!placeId) {
      return NextResponse.json({ success: false, error: 'placeId ist erforderlich' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GOOGLE_MAPS_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const photos = await fetchPlacePhotosForPicker(placeId, apiKey)
    return NextResponse.json({ success: true, data: { photos } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
