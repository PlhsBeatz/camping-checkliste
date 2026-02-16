import { NextRequest, NextResponse } from 'next/server'
import { 
  getDB, 
  getTags, 
  createTag, 
  updateTag, 
  deleteTag,
  CloudflareEnv 
} from '@/lib/db'

export async function GET() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const tags = await getTags(db)

    return NextResponse.json({ success: true, data: tags })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as { titel?: string; farbe?: string | null; icon?: string | null; beschreibung?: string | null }
    const { titel, farbe, icon, beschreibung } = body

    if (!titel) {
      return NextResponse.json({ error: 'titel is required' }, { status: 400 })
    }

    const id = await createTag(db, titel, farbe, icon, beschreibung)

    if (!id) {
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 400 })
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
    const body = (await request.json()) as { id?: string; titel?: string; farbe?: string | null; icon?: string | null; beschreibung?: string | null }
    const { id, titel, farbe, icon, beschreibung } = body

    if (!id || !titel) {
      return NextResponse.json({ error: 'id and titel are required' }, { status: 400 })
    }

    const success = await updateTag(db, id, titel, farbe, icon, beschreibung)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update tag' }, { status: 400 })
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

    const success = await deleteTag(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
