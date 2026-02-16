import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import {
  getDB,
  CloudflareEnv,
  setMitreisenderAnzahl,
  getVacationIdFromPackingItem,
} from '@/lib/db'
import { notifyPackingSyncChange } from '@/lib/packing-sync'

export async function PUT(request: Request) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)

    const body = (await request.json()) as {
      packingItemId?: string
      mitreisenderId?: string
      anzahl?: number
    }
    const { packingItemId, mitreisenderId, anzahl } = body

    if (!packingItemId || !mitreisenderId || anzahl === undefined || anzahl < 0) {
      return NextResponse.json(
        { success: false, error: 'packingItemId, mitreisenderId and anzahl (>= 0) are required' },
        { status: 400 }
      )
    }

    const success = await setMitreisenderAnzahl(db, packingItemId, mitreisenderId, anzahl)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to set anzahl or mitreisender not found' },
        { status: 400 }
      )
    }

    const vacationId = await getVacationIdFromPackingItem(db, packingItemId)
    if (vacationId) {
      const cfEnv = getCloudflareContext().env as unknown as CloudflareEnv
      await notifyPackingSyncChange(cfEnv, vacationId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error setting mitreisender anzahl:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
