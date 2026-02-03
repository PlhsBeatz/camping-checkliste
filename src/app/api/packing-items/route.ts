import { NextRequest, NextResponse } from 'next/server'
import { getDB, getPackingItems, updatePackingItem, addPackingItem, deletePackingItem, getPacklisteId, CloudflareEnv } from '@/lib/db'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')

    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId is required' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const items = await getPackingItems(db, vacationId)

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
    const { vacationId, gegenstandId, anzahl, bemerkung, transportId, mitreisende } = body

    if (!vacationId || !gegenstandId) {
      return NextResponse.json({ error: 'vacationId and gegenstandId are required' }, { status: 400 })
    }

    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Packliste not found' }, { status: 404 })
    }

    const itemId = await addPackingItem(db, packlisteId, gegenstandId, anzahl || 1, bemerkung, transportId, mitreisende)

    if (!itemId) {
      return NextResponse.json({ error: 'Failed to add packing item' }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
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
    const { id, gepackt, anzahl, bemerkung } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await updatePackingItem(db, id, { gepackt, anzahl, bemerkung })

    return NextResponse.json({ success: true, data: success })
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

    const success = await deletePackingItem(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete packing item' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
