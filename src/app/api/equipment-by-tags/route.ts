import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEquipmentByTags, getTagsForEquipment, getStandardMitreisendeForEquipment, CloudflareEnv } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const { searchParams } = new URL(request.url)
    
    const tagIds = searchParams.getAll('tagIds')
    const includeStandard = searchParams.get('includeStandard') === 'true'

    const items = await getEquipmentByTags(db, tagIds, includeStandard)
    
    // Load tags and standard_mitreisende for each item (für Generator: ausgewaehlte-Zuordnung)
    for (const item of items) {
      const [tags, standardMitreisende] = await Promise.all([
        getTagsForEquipment(db, item.id),
        getStandardMitreisendeForEquipment(db, item.id),
      ])
      item.tags = tags
      item.standard_mitreisende = standardMitreisende
    }

    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
