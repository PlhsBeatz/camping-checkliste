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

    interface PostCategoryBody {
      titel: string
      hauptkategorieId: string | number
      reihenfolge?: number
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Ungültiger JSON-Body' }, { status: 400 })
    }

    function isValidPostCategoryBody(obj: unknown): obj is PostCategoryBody {
      if (obj === null || typeof obj !== 'object') return false
      const o = obj as Record<string, unknown>
      const titel = o['titel']
      const hauptkategorieId = o['hauptkategorieId']
      return (
        typeof titel === 'string' &&
        titel.trim().length > 0 &&
        (typeof hauptkategorieId === 'string' || typeof hauptkategorieId === 'number')
      )
    }

    if (!isValidPostCategoryBody(body)) {
      return NextResponse.json(
        { error: 'titel (string, nicht leer) und hauptkategorieId (string/number) sind erforderlich' },
        { status: 400 }
      )
    }

    const { titel, hauptkategorieId, reihenfolge } = body

    const id = await createCategory(db, titel, String(hauptkategorieId), reihenfolge)

    if (!id) {
      return NextResponse.json({ error: 'Failed to create category' }, { status: 400 })
    }

    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

interface PutCategoryBody {
  id: string
  titel: string
  hauptkategorieId?: string
  reihenfolge?: number
}

export async function PUT(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as PutCategoryBody
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
