import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEquipmentByTags, getTagsForEquipment, CloudflareEnv } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const { searchParams } = new URL(request.url)
    
    const tagIds = searchParams.getAll('tagIds')
    const includeStandard = searchParams.get('includeStandard') === 'true'

    const items = await getEquipmentByTags(db, tagIds, includeStandard)
    
    // Load tags for each item
    for (const item of items) {
      const tags = await getTagsForEquipment(db, item.id)
      item.tags = tags
    }

    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
