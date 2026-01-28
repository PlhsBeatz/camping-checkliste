import { NextRequest, NextResponse } from 'next/server'
import { getEquipmentItems, createEquipmentItem, initializeDatabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    await initializeDatabase(db)
    const items = await getEquipmentItems(db)

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch equipment items' }, { status: 500 })
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
    const item = await createEquipmentItem(db, {
      title: body.title,
      category: body.category,
      mainCategory: body.mainCategory,
      weight: body.weight,
      defaultQuantity: body.defaultQuantity || 1,
      status: body.status,
      details: body.details,
      links: body.links,
    })

    if (!item) {
      return NextResponse.json({ error: 'Failed to create equipment item' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create equipment item' }, { status: 500 })
  }
}
