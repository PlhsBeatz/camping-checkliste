import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getMitreisende,
  getMitreisendeForVacation,
  createMitreisender,
  updateMitreisender,
  deleteMitreisender,
  setMitreisendeForVacation,
  getMitreisendenGruppen,
  mitreisendenGruppeExists,
  CloudflareEnv,
  type Personentyp,
} from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'
import { canAccessVacation } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')
    const includeGroups = searchParams.get('includeGroups') === '1'
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    if (vacationId) {
      const mitreisende = await getMitreisendeForVacation(db, vacationId)
      const ids = mitreisende.map((m) => m.id)
      if (!canAccessVacation(userContext, ids)) {
        return NextResponse.json({ error: 'Keine Berechtigung für diesen Urlaub' }, { status: 403 })
      }
      return NextResponse.json({ success: true, data: mitreisende })
    }

    const adminErr = requireAdmin(userContext)
    if (adminErr) return adminErr
    const mitreisende = await getMitreisende(db)
    const gruppen = includeGroups ? await getMitreisendenGruppen(db) : undefined
    return NextResponse.json({ success: true, data: mitreisende, gruppen })
  } catch (error) {
    console.error('Error in GET /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
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
      userId?: string | null
      user_id?: string | null
      isDefaultMember?: boolean
      is_default_member?: boolean
      gruppeId?: string | null
      gruppe_id?: string | null
      personentyp?: Personentyp
      farbe?: string | null
    }
    const { name, userId, user_id, isDefaultMember, is_default_member, gruppeId, gruppe_id, personentyp, farbe } =
      body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    const finalUserId = userId ?? user_id
    const finalIsDefault = isDefaultMember ?? is_default_member
    const finalGruppeId = gruppeId ?? gruppe_id

    if (finalGruppeId && !(await mitreisendenGruppeExists(db, finalGruppeId))) {
      return NextResponse.json(
        { success: false, error: 'Der gewählte Haushalt existiert nicht. Bitte Seite aktualisieren.' },
        { status: 400 }
      )
    }

    const id = await createMitreisender(db, name, {
      userId: finalUserId,
      isDefaultMember: finalIsDefault,
      gruppeId: finalGruppeId,
      personentyp: personentyp ?? 'erwachsen',
      farbe,
    })

    return NextResponse.json({ success: true, data: { id } })
  } catch (error) {
    console.error('Error in POST /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const status = errorMessage.includes('FOREIGN KEY') || errorMessage.includes('existiert nicht') ? 400 : 500
    return NextResponse.json({ success: false, error: errorMessage }, { status })
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
      userId?: string | null
      user_id?: string | null
      isDefaultMember?: boolean
      is_default_member?: boolean
      gruppeId?: string | null
      gruppe_id?: string | null
      personentyp?: Personentyp
      farbe?: string | null
      vacationId?: string
      mitreisendeIds?: string[]
    }
    const {
      id,
      name,
      userId,
      user_id,
      isDefaultMember,
      is_default_member,
      gruppeId,
      gruppe_id,
      personentyp,
      farbe,
      vacationId,
      mitreisendeIds,
    } = body

    if (vacationId && mitreisendeIds) {
      const success = await setMitreisendeForVacation(db, vacationId, mitreisendeIds)
      if (!success) {
        return NextResponse.json({ success: false, error: 'Failed to set mitreisende for vacation' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    if (!id || !name) {
      return NextResponse.json({ success: false, error: 'ID and name are required' }, { status: 400 })
    }

    const finalUserId = userId ?? user_id
    const finalIsDefault = isDefaultMember ?? is_default_member
    const finalGruppeId = gruppeId ?? gruppe_id

    if (finalGruppeId && !(await mitreisendenGruppeExists(db, finalGruppeId))) {
      return NextResponse.json(
        { success: false, error: 'Der gewählte Haushalt existiert nicht. Bitte Seite aktualisieren.' },
        { status: 400 }
      )
    }

    await updateMitreisender(db, id, name, {
      userId: finalUserId,
      isDefaultMember: finalIsDefault,
      gruppeId: finalGruppeId,
      personentyp,
      farbe,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const status = errorMessage.includes('FOREIGN KEY') || errorMessage.includes('existiert nicht') ? 400 : 500
    return NextResponse.json({ success: false, error: errorMessage }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const adminErr = requireAdmin(auth.userContext)
    if (adminErr) return adminErr
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 })
    }

    const success = await deleteMitreisender(db, id)

    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete mitreisender' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/mitreisende:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
