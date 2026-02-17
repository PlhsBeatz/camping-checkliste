import { NextRequest, NextResponse } from 'next/server'
import {
  getDB,
  getEquipmentByTags,
  getTagsForEquipmentBatch,
  getStandardMitreisendeForEquipmentBatch,
  CloudflareEnv,
} from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const { searchParams } = new URL(request.url)
    
    const tagIds = searchParams.getAll('tagIds')
    const includeStandard = searchParams.get('includeStandard') === 'true'

    const items = await getEquipmentByTags(db, tagIds, includeStandard)
    const gegenstandIds = items.map((item) => String(item.id))

    // Batch: Tags und Standard-Mitreisende laden (für Generator: ausgewaehlte-Zuordnung)
    const [tagsMap, smMap] = await Promise.all([
      getTagsForEquipmentBatch(db, gegenstandIds),
      getStandardMitreisendeForEquipmentBatch(db, gegenstandIds),
    ])
    for (const item of items) {
      item.tags = tagsMap.get(String(item.id)) || []
      item.standard_mitreisende = smMap.get(String(item.id)) || []
    }

    const res = NextResponse.json({ success: true, data: items })
    res.headers.set(
      'Cache-Control',
      'public, max-age=60, s-maxage=60, stale-while-revalidate=120'
    )
    return res
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
