import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, createVacation, updateVacation, deleteVacation, CloudflareEnv } from '@/lib/db'

export const runtime = 'edge'

export async function GET() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const vacations = await getVacations(db)
    return NextResponse.json({ success: true, data: vacations })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = await request.json()

    const vacation = await createVacation(db, {
      titel: body.titel || body.title,
      startdatum: body.startdatum || body.startDate,
      abfahrtdatum: body.abfahrtdatum || null,
      enddatum: body.enddatum || body.endDate,
      reiseziel_name: body.reiseziel_name || body.destination,
      reiseziel_adresse: body.reiseziel_adresse || null,
      land_region: body.land_region || null
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
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = await request.json()
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
