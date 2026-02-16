import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  getPackingItems,
  updatePackingItem,
  addPackingItem,
  deletePackingItem,
  getPacklisteId,
  getVacationIdFromPackingItem,
  CloudflareEnv,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'

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
    const body = (await request.json()) as {
      vacationId?: string
      gegenstandId?: string
      anzahl?: number
      bemerkung?: string | null
      transportId?: string | null
      mitreisende?: string[]
    }
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

    const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)

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
    const body = (await request.json()) as {
      id?: string
      gepackt?: boolean
      anzahl?: number
      bemerkung?: string | null
      transport_id?: string | null
    }
    const { id, gepackt, anzahl, bemerkung, transport_id } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const success = await updatePackingItem(db, id, {
      gepackt,
      anzahl,
      bemerkung,
      transport_id: transport_id ?? undefined,
    })

    if (success) {
      const vacationId = await getVacationIdFromPackingItem(db, id)
      if (vacationId) {
        const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
        await notifyPackingSyncChange(cfEnv, vacationId)
      }
    }

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

    const vacationId = await getVacationIdFromPackingItem(db, id)
    const success = await deletePackingItem(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete packing item' }, { status: 400 })
    }

    if (vacationId) {
      const env = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(env, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
