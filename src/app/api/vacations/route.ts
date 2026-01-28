import { NextRequest, NextResponse } from 'next/server'
import { getVacations, createVacation, initializeDatabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    await initializeDatabase(db)
    const vacations = await getVacations(db)

    return NextResponse.json({ success: true, data: vacations })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch vacations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const vacation = await createVacation(db, {
      title: body.title,
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      travelers: body.travelers,
    })

    if (!vacation) {
      return NextResponse.json({ error: 'Failed to create vacation' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: vacation }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create vacation' }, { status: 500 })
  }
}
