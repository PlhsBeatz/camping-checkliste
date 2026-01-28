import { NextRequest, NextResponse } from 'next/server'
import { getPackingItems, createPackingItem, updatePackingItem, deletePackingItem, initializeDatabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')

    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId is required' }, { status: 400 })
    }

    await initializeDatabase(db)
    const items = await getPackingItems(db, vacationId)

    return NextResponse.json({ success: true, data: items })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to fetch packing items' }, { status: 500 })
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
    const item = await createPackingItem(db, {
      vacationId: body.vacationId,
      name: body.name,
      quantity: body.quantity || 1,
      isPacked: body.isPacked || false,
      category: body.category,
      mainCategory: body.mainCategory,
      details: body.details,
      weight: body.weight,
    })

    if (!item) {
      return NextResponse.json({ error: 'Failed to create packing item' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to create packing item' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await updatePackingItem(db, id, updates)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update packing item' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to update packing item' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await deletePackingItem(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete packing item' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Failed to delete packing item' }, { status: 500 })
  }
}
