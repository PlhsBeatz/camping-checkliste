import { NextRequest, NextResponse } from 'next/server'
import {
  CloudflareEnv,
  getDB,
  getCampingplaetze,
  getUrlaubCountByCampingplatzIds,
  createCampingplatz,
  updateCampingplatz,
  deleteCampingplatz,
  archiveCampingplatz,
  getCampingplatzById,
  getCampingplatzFotos,
  createCampingplatzFoto,
  getCampingPhotosR2,
  deleteRoutesForCampingplatz,
  getUrlaubCountForCampingplatz,
  getUserById,
  getRoutesForUserAndCampingplatzIds,
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
    const db = await getDB(env)

    const campingplaetze = await getCampingplaetze(db, { includeArchived })
    const ids = campingplaetze.map((c) => c.id)
    const counts = await getUrlaubCountByCampingplatzIds(db, ids)

    const user = await getUserById(db, auth.userContext.userId)
    const routesByCp =
      user?.heimat_lat != null &&
      user?.heimat_lng != null &&
      ids.length > 0
        ? await getRoutesForUserAndCampingplatzIds(db, auth.userContext.userId, ids)
        : new Map()

    const data = campingplaetze.map((c) => {
      const cached = routesByCp.get(c.id)
      const route_from_home =
        cached != null
          ? {
              distanceKm: cached.distance_km,
              durationMinutes: cached.duration_min,
              provider: cached.provider,
            }
          : undefined
      return {
        ...c,
        urlaube_zuordnungen: counts[c.id] ?? 0,
        ...(route_from_home ? { route_from_home } : {}),
      }
    })
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
      aufwunschliste?: boolean
      top_favorit?: boolean
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
      aufwunschliste: body.aufwunschliste,
      top_favorit: body.top_favorit,
    })

    if (!campingplatz) {
      return NextResponse.json(
        { success: false, error: 'Failed to create campingplatz' },
        { status: 500 }
      )
    }

    if (
      body.photo_name &&
      String(body.photo_name).startsWith('places/') &&
      (await getCampingplatzFotos(db, campingplatz.id)).length === 0
    ) {
      await createCampingplatzFoto(db, {
        campingplatz_id: campingplatz.id,
        source: 'google',
        google_photo_name: String(body.photo_name),
        setAsCover: true,
      })
    }

    const withJoin = await getCampingplatzById(db, campingplatz.id)
    const cp = withJoin ?? campingplatz
    const urlaube_zuordnungen = await getUrlaubCountForCampingplatz(db, cp.id)
    return NextResponse.json({ success: true, data: { ...cp, urlaube_zuordnungen } }, { status: 201 })
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
      aufwunschliste?: boolean
      top_favorit?: boolean
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
      aufwunschliste: body.aufwunschliste,
      top_favorit: body.top_favorit,
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

    if (
      body.photo_name &&
      String(body.photo_name).startsWith('places/') &&
      (await getCampingplatzFotos(db, updated.id)).length === 0
    ) {
      await createCampingplatzFoto(db, {
        campingplatz_id: updated.id,
        source: 'google',
        google_photo_name: String(body.photo_name),
        setAsCover: true,
      })
    }

    const withJoin = await getCampingplatzById(db, updated.id)
    const cp = withJoin ?? updated
    const urlaube_zuordnungen = await getUrlaubCountForCampingplatz(db, cp.id)
    return NextResponse.json({ success: true, data: { ...cp, urlaube_zuordnungen } })
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

    const r2Keys = await db
      .prepare(
        `SELECT r2_object_key FROM campingplatz_fotos
         WHERE campingplatz_id = ? AND r2_object_key IS NOT NULL`
      )
      .bind(id)
      .all<{ r2_object_key: string }>()
    const bucket = await getCampingPhotosR2(env)
    if (bucket && r2Keys.results?.length) {
      for (const row of r2Keys.results) {
        if (row.r2_object_key) await bucket.delete(row.r2_object_key)
      }
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

