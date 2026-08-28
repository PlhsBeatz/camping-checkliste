import { NextRequest, NextResponse } from 'next/server'
import { getDB, type CloudflareEnv } from '@/lib/db'
import { requireAuth } from '@/lib/api-auth'
import { suggestCategoryForName } from '@/lib/packing-category-suggest'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) return auth
    const env = process.env as unknown as CloudflareEnv
    const db = await getDB(env)
    const body = (await request.json()) as { name?: string }
    const name = body.name?.trim() ?? ''
    if (name.length < 2) {
      return NextResponse.json({ success: true, data: null })
    }
    const match = await suggestCategoryForName(db, name, {
      apiKey: env.OPENROUTER_API_KEY?.trim() ?? null,
      allowAi: true,
    })
    return NextResponse.json({ success: true, data: match })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
