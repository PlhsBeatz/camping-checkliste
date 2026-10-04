import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  updateCampingStayStellplatz,
  type CloudflareEnv,
  type StayStellplatzFields,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const { id: stayId } = await params
    const body = (await request.json()) as StayStellplatzFields & {
      clear?: boolean
    }

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    const fields: StayStellplatzFields = body.clear
      ? { stellplatz_lat: null, stellplatz_lng: null, wohnwagen_heading_deg: null }
      : {
          stellplatz_lat:
            body.stellplatz_lat === undefined ? undefined : body.stellplatz_lat,
          stellplatz_lng:
            body.stellplatz_lng === undefined ? undefined : body.stellplatz_lng,
          wohnwagen_heading_deg:
            body.wohnwagen_heading_deg === undefined
              ? undefined
              : body.wohnwagen_heading_deg,
        }

    // Partial update: fehlende Felder aus DB lesen
    if (!body.clear) {
      const current = await db
        .prepare(
          `SELECT stellplatz_lat, stellplatz_lng, wohnwagen_heading_deg
           FROM urlaub_campingplaetze WHERE id = ?`
        )
        .bind(stayId)
        .first<{
          stellplatz_lat: number | null
          stellplatz_lng: number | null
          wohnwagen_heading_deg: number | null
        }>()
      if (!current) {
        return NextResponse.json(
          { success: false, error: 'Aufenthalt nicht gefunden' },
          { status: 404 }
        )
      }
      if (fields.stellplatz_lat === undefined) {
        fields.stellplatz_lat = current.stellplatz_lat
      }
      if (fields.stellplatz_lng === undefined) {
        fields.stellplatz_lng = current.stellplatz_lng
      }
      if (fields.wohnwagen_heading_deg === undefined) {
        fields.wohnwagen_heading_deg = current.wohnwagen_heading_deg
      }
    }

    const ok = await updateCampingStayStellplatz(db, stayId, fields)
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Speichern fehlgeschlagen' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true, data: fields })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
