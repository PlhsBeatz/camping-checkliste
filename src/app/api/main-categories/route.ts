import { NextRequest, NextResponse } from 'next/server'
import { 
  getDB, 
  getMainCategories, 
  createMainCategory, 
  updateMainCategory, 
  deleteMainCategory,
  CloudflareEnv 
} from '@/lib/db'

export async function GET() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const mainCategories = await getMainCategories(db)

    return NextResponse.json({ success: true, data: mainCategories })
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
      titel?: string
      reihenfolge?: number
      pauschalgewicht?: number | null
      pauschal_pro_person?: boolean
      pauschal_transport_id?: string | null
    }
    const { titel, reihenfolge, pauschalgewicht, pauschal_pro_person, pauschal_transport_id } = body

    if (!titel) {
      return NextResponse.json({ error: 'titel is required' }, { status: 400 })
    }

    const id = await createMainCategory(
      db,
      titel,
      reihenfolge,
      pauschalgewicht,
      pauschal_pro_person,
      pauschal_transport_id
    )

    if (!id) {
      return NextResponse.json({ error: 'Failed to create main category' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id }, { status: 201 })
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
      titel?: string
      reihenfolge?: number
      pauschalgewicht?: number | null
      pauschal_pro_person?: boolean
      pauschal_transport_id?: string | null
    }
    const { id, titel, reihenfolge, pauschalgewicht, pauschal_pro_person, pauschal_transport_id } = body

    if (!id || !titel) {
      return NextResponse.json({ error: 'id and titel are required' }, { status: 400 })
    }

    const success = await updateMainCategory(
      db,
      id,
      titel,
      reihenfolge,
      pauschalgewicht,
      pauschal_pro_person,
      pauschal_transport_id
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to update main category' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
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

    const success = await deleteMainCategory(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete main category. It may have existing categories.' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
