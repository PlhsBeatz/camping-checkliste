import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB, addPackingItem, getPacklisteId, CloudflareEnv } from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'

/** Batch: mehrere Packlisten-Einträge in einem Request – vermeidet Worker-Überlastung */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const body = (await request.json()) as {
      vacationId?: string
      items?: Array<{
        gegenstandId: string
        anzahl?: number
        bemerkung?: string | null
        transportId?: string | null
        mitreisende?: string[]
      }>
    }
    const { vacationId, items } = body

    if (!vacationId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'vacationId and non-empty items array required' },
        { status: 400 }
      )
    }

    const packlisteId = await getPacklisteId(db, vacationId)
    if (!packlisteId) {
      return NextResponse.json({ error: 'Packliste not found' }, { status: 404 })
    }

    const results: { success: boolean; gegenstandId?: string }[] = []
    for (const item of items) {
      const { gegenstandId, anzahl = 1, bemerkung, transportId, mitreisende } = item
      if (!gegenstandId) continue
      const id = await addPackingItem(
        db,
        packlisteId,
        gegenstandId,
        anzahl,
        bemerkung,
        transportId ?? null,
        mitreisende ?? []
      )
      results.push({ success: !!id, gegenstandId })
    }

    const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
    await notifyPackingSyncChange(cfEnv, vacationId)

    const successCount = results.filter(r => r.success).length
    return NextResponse.json({
      success: true,
      data: { added: successCount, total: items.length, results },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
