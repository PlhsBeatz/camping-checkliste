import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getMitreisendenGruppen,
  createMitreisendenGruppe,
  updateMitreisendenGruppe,
  deleteMitreisendenGruppe,
  countMitreisendeInGruppe,
  CloudflareEnv,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const gruppen = await getMitreisendenGruppen(db)
    return NextResponse.json({ success: true, data: gruppen })
  } catch (error) {
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
      urlaubStandardMitnehmen?: boolean
      urlaub_standard_mitnehmen?: boolean
      sortOrder?: number
      sort_order?: number
    }
    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ success: false, error: 'Name ist erforderlich' }, { status: 400 })
    }

    const id = await createMitreisendenGruppe(db, name, {
      urlaubStandardMitnehmen: body.urlaubStandardMitnehmen ?? body.urlaub_standard_mitnehmen ?? false,
      sortOrder: body.sortOrder ?? body.sort_order,
    })
    if (!id) {
      return NextResponse.json({ success: false, error: 'Gruppe konnte nicht erstellt werden' }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
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
      urlaubStandardMitnehmen?: boolean
      urlaub_standard_mitnehmen?: boolean
      sortOrder?: number
      sort_order?: number
    }
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID ist erforderlich' }, { status: 400 })
    }

    const urlaubFlag = body.urlaubStandardMitnehmen ?? body.urlaub_standard_mitnehmen
    const sortOrder = body.sortOrder ?? body.sort_order
    const success = await updateMitreisendenGruppe(db, body.id, {
      name: body.name,
      urlaubStandardMitnehmen: urlaubFlag,
      sortOrder,
    })
    if (!success) {
      return NextResponse.json({ success: false, error: 'Gruppe konnte nicht aktualisiert werden' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
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
    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID ist erforderlich' }, { status: 400 })
    }

    const memberCount = await countMitreisendeInGruppe(db, id)
    if (memberCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Die Gruppe enthält noch ${memberCount} Person(en). Bitte zuerst verschieben oder löschen.`,
        },
        { status: 400 }
      )
    }

    const success = await deleteMitreisendenGruppe(db, id)
    if (!success) {
      return NextResponse.json({ success: false, error: 'Gruppe konnte nicht gelöscht werden' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
