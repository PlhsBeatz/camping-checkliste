import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingplaetze,
  createCampingplatz,
  updateCampingplatz,
  deleteCampingplatz,
  archiveCampingplatz,
  getCampingplatzById,
  deleteRoutesForCampingplatz,
  CampingplatzTyp,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get('includeArchived') === 'true'
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const campingplaetze = await getCampingplaetze(db, { includeArchived })
    return NextResponse.json({ success: true, data: campingplaetze })
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
    const db = getDB(env)

    const body = (await request.json()) as {
      name?: string
      land?: string
      bundesland?: string | null
      ort?: string
      webseite?: string | null
      video_link?: string | null
      platz_typ?: string
      pros?: string[]
      cons?: string[]
      adresse?: string | null
      lat?: number | null
      lng?: number | null
      photo_name?: string | null
    }

    if (!body.name || !body.land || !body.ort || !body.platz_typ) {
      return NextResponse.json(
        { success: false, error: 'name, land, ort und platz_typ sind erforderlich' },
        { status: 400 }
      )
    }

    const campingplatz = await createCampingplatz(db, {
      name: body.name,
      land: body.land,
      bundesland: body.bundesland ?? null,
      ort: body.ort,
      webseite: body.webseite ?? null,
      video_link: body.video_link ?? null,
      platz_typ: body.platz_typ as CampingplatzTyp,
      pros: body.pros ?? [],
      cons: body.cons ?? [],
      adresse: body.adresse ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      photo_name: body.photo_name ?? null,
    })

    if (!campingplatz) {
      return NextResponse.json(
        { success: false, error: 'Failed to create campingplatz' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: campingplatz }, { status: 201 })
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
    const db = getDB(env)

    const body = (await request.json()) as {
      id?: string
      name?: string
      land?: string
      bundesland?: string | null
      ort?: string
      webseite?: string | null
      video_link?: string | null
      platz_typ?: string
      pros?: string[]
      cons?: string[]
      adresse?: string | null
      lat?: number | null
      lng?: number | null
      photo_name?: string | null
      is_archived?: boolean
    }

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const before = await getCampingplatzById(db, body.id)
    const updated = await updateCampingplatz(db, body.id, {
      name: body.name,
      land: body.land,
      bundesland: body.bundesland ?? null,
      ort: body.ort,
      webseite: body.webseite ?? null,
      video_link: body.video_link ?? null,
      platz_typ: body.platz_typ as CampingplatzTyp,
      pros: body.pros,
      cons: body.cons,
      adresse: body.adresse ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      photo_name: body.photo_name ?? null,
      is_archived: body.is_archived,
    })

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update campingplatz' },
        { status: 500 }
      )
    }

    const coordsChanged =
      before &&
      (before.lat !== updated.lat ||
        before.lng !== updated.lng ||
        before.adresse !== updated.adresse)

    if (coordsChanged) {
      await deleteRoutesForCampingplatz(db, updated.id)
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
    const db = getDB(env)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const forceArchive = searchParams.get('forceArchive') === 'true'

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const refCountResult = await db
      .prepare(
        'SELECT COUNT(*) as c FROM urlaub_campingplaetze WHERE campingplatz_id = ?'
      )
      .bind(id)
      .first<{ c: number }>()
    const refCount = refCountResult?.c ?? 0

    if (refCount > 0 && !forceArchive) {
      return NextResponse.json(
        {
          success: false,
          requireArchive: true,
          error:
            'Campingplatz ist bereits mit Urlaubsreisen verknüpft und kann nicht direkt gelöscht werden.',
        },
        { status: 409 }
      )
    }

    if (refCount > 0 && forceArchive) {
      const ok = await archiveCampingplatz(db, id)
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to archive campingplatz' },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, archived: true })
    }

    const success = await deleteCampingplatz(db, id)
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete campingplatz' },
        { status: 500 }
      )
    }

    await deleteRoutesForCampingplatz(db, id)

    return NextResponse.json({ success: true, archived: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

