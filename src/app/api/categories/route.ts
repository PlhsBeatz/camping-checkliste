import { NextRequest, NextResponse } from 'next/server'
import { 
  getDB, 
  getCategoriesWithMainCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory,
  CloudflareEnv 
} from '@/lib/db'

export async function GET() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const categories = await getCategoriesWithMainCategories(db)

    return NextResponse.json({ success: true, data: categories })
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
    const { titel, hauptkategorieId, reihenfolge } = body

    if (!titel || !hauptkategorieId) {
      return NextResponse.json({ error: 'titel and hauptkategorieId are required' }, { status: 400 })
    }

    const id = await createCategory(db, titel, hauptkategorieId, reihenfolge)

    if (!id) {
      return NextResponse.json({ error: 'Failed to create category' }, { status: 400 })
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
    const body = await request.json()
    const { id, titel, hauptkategorieId, reihenfolge } = body

    if (!id || !titel) {
      return NextResponse.json({ error: 'id and titel are required' }, { status: 400 })
    }

    const success = await updateCategory(db, id, titel, hauptkategorieId, reihenfolge)

    if (!success) {
      return NextResponse.json({ error: 'Failed to update category' }, { status: 400 })
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

    const success = await deleteCategory(db, id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
