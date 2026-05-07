import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingplatzById,
  getCampingplatzFotos,
  getUrlaubCountForCampingplatz,
} from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ success: false, error: 'Fehlende ID' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const campingplatz = await getCampingplatzById(db, id)
    if (!campingplatz) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    const fotos = await getCampingplatzFotos(db, id)
    const urlaube_zuordnungen = await getUrlaubCountForCampingplatz(db, id)
    return NextResponse.json({
      success: true,
      data: {
        campingplatz: { ...campingplatz, urlaube_zuordnungen },
        fotos,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
