import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, createVacation, updateVacation, deleteVacation, CloudflareEnv } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const { userContext } = auth
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const mitreisenderFilter = userContext.role === 'gast' ? userContext.mitreisenderId : undefined
    const vacations = await getVacations(db, mitreisenderFilter)
    return NextResponse.json({ success: true, data: vacations })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
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
      titel?: string
      title?: string
      startdatum?: string
      startDate?: string
      abfahrtdatum?: string | null
      enddatum?: string
      endDate?: string
      reiseziel_name?: string
      destination?: string
      reiseziel_adresse?: string | null
      land_region?: string | null
    }

    const titel = body.titel ?? body.title ?? ''
    const startdatum = body.startdatum ?? body.startDate ?? ''
    const enddatum = body.enddatum ?? body.endDate ?? ''
    const reiseziel_name = body.reiseziel_name ?? body.destination ?? ''

    if (!titel || !startdatum || !enddatum) {
      return NextResponse.json({ error: 'titel, startdatum and enddatum are required' }, { status: 400 })
    }

    const vacation = await createVacation(db, {
      titel,
      startdatum,
      abfahrtdatum: body.abfahrtdatum ?? null,
      enddatum,
      reiseziel_name,
      reiseziel_adresse: body.reiseziel_adresse ?? null,
      land_region: body.land_region ?? null
    })

    if (!vacation) {
      return NextResponse.json({ error: 'Failed to create vacation' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: vacation }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
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
      titel?: string
      startdatum?: string
      abfahrtdatum?: string | null
      enddatum?: string
      reiseziel_name?: string
      reiseziel_adresse?: string | null
      land_region?: string | null
    }
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const vacation = await updateVacation(db, id, updates)

    if (!vacation) {
      return NextResponse.json({ error: 'Failed to update vacation' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: vacation })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
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

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await deleteVacation(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete vacation' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
