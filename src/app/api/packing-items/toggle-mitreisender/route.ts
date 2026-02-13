import { NextResponse } from 'next/server'
import { getDB, CloudflareEnv, togglePackingItemForMitreisender } from '@/lib/db'

export async function PUT(request: Request) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    
    const body = await request.json()
    const { packingItemId, mitreisenderId, gepackt } = body

    if (!packingItemId || !mitreisenderId || gepackt === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use the DB function which handles both INSERT and UPDATE
    const success = await togglePackingItemForMitreisender(
      db,
      packingItemId,
      mitreisenderId,
      gepackt
    )

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update status' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error toggling mitreisender status:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
