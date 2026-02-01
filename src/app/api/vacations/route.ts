import { NextRequest, NextResponse } from 'next/server'
import { getDB, getVacations, createVacation } from '@/lib/db'

export const runtime = 'edge'

export async function GET() {
  try {
    const env = process.env as any
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
    const env = process.env as any
    const db = getDB(env)
    const body = await request.json()

    const vacation = await createVacation(db, {
      titel: body.titel || body.title,
      startdatum: body.startdatum || body.startDate,
      enddatum: body.enddatum || body.endDate,
      reiseziel_name: body.reiseziel_name || body.destination
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
