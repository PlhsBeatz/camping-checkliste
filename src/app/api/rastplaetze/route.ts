import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getRastplaetze,
  getRastplatzById,
  createRastplatz,
  updateRastplatz,
  deleteRastplatz,
  archiveRastplatz,
  type RastplatzBewertung,
  type RastplatzKategorie,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const data = await getRastplaetze(db, { includeArchived })
    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      name?: string
      bewertung?: string
      kategorie?: string
      merkmale?: string[]
      bemerkungen?: string | null
      adresse?: string | null
      ort?: string | null
      land?: string | null
      bundesland?: string | null
      lat?: number
      lng?: number
      google_place_id?: string | null
      entdeckt_urlaub_id?: string | null
      entdeckt_am?: string | null
    }

    if (!body.name || !body.bewertung || !body.kategorie || body.lat == null || body.lng == null) {
      return NextResponse.json(
        { success: false, error: 'name, bewertung, kategorie, lat und lng sind erforderlich' },
        { status: 400 }
      )
    }

    const rastplatz = await createRastplatz(db, {
      name: body.name,
      bewertung: body.bewertung as RastplatzBewertung,
      kategorie: body.kategorie as RastplatzKategorie,
      merkmale: body.merkmale ?? [],
      bemerkungen: body.bemerkungen ?? null,
      adresse: body.adresse ?? null,
      ort: body.ort ?? null,
      land: body.land ?? null,
      bundesland: body.bundesland ?? null,
      lat: body.lat,
      lng: body.lng,
      google_place_id: body.google_place_id ?? null,
      entdeckt_urlaub_id: body.entdeckt_urlaub_id ?? null,
      entdeckt_am: body.entdeckt_am ?? null,
    })

    if (!rastplatz) {
      return NextResponse.json({ success: false, error: 'Failed to create rastplatz' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: rastplatz }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as {
      id?: string
      name?: string
      bewertung?: string
      kategorie?: string
      merkmale?: string[]
      bemerkungen?: string | null
      adresse?: string | null
      ort?: string | null
      land?: string | null
      bundesland?: string | null
      lat?: number
      lng?: number
      google_place_id?: string | null
      is_archived?: boolean
    }

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const updated = await updateRastplatz(db, body.id, {
      name: body.name,
      bewertung: body.bewertung as RastplatzBewertung | undefined,
      kategorie: body.kategorie as RastplatzKategorie | undefined,
      merkmale: body.merkmale,
      bemerkungen: body.bemerkungen,
      adresse: body.adresse,
      ort: body.ort,
      land: body.land,
      bundesland: body.bundesland,
      lat: body.lat,
      lng: body.lng,
      google_place_id: body.google_place_id,
      is_archived: body.is_archived,
    })

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Failed to update rastplatz' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr

    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const forceArchive = searchParams.get('forceArchive') === 'true'

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const existing = await getRastplatzById(db, id)
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 })
    }

    if (forceArchive) {
      const ok = await archiveRastplatz(db, id)
      if (!ok) {
        return NextResponse.json({ success: false, error: 'Failed to archive' }, { status: 500 })
      }
      return NextResponse.json({ success: true, archived: true })
    }

    const success = await deleteRastplatz(db, id)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
    }
    return NextResponse.json({ success: true, archived: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
