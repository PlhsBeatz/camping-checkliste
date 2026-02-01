import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getEquipmentItems,
  getEquipmentItem,
  createEquipmentItem,
  updateEquipmentItem,
  deleteEquipmentItem,
  CloudflareEnv
} from '@/lib/db'

export const runtime = 'edge'

export async function GET() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const items = await getEquipmentItems(db)
    return NextResponse.json({ success: true, data: items })
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

    const item = await createEquipmentItem(db, {
      was: body.was,
      kategorie_id: body.kategorie_id,
      einzelgewicht: body.einzelgewicht,
      standard_anzahl: body.standard_anzahl,
      status: body.status,
      details: body.details
    })

    if (!item) {
      return NextResponse.json({ error: 'Failed to create equipment item' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: item }, { status: 201 })
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

    const item = await updateEquipmentItem(db, id, updates)

    if (!item) {
      return NextResponse.json({ error: 'Failed to update equipment item' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: item })
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

    const success = await deleteEquipmentItem(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete equipment item' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
