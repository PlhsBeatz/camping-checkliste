import { NextResponse } from 'next/server'
import { getDB, CloudflareEnv } from '@/lib/db'

export const runtime = 'edge'

export async function PUT(request: Request) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    
    const body = await request.json()
    const { packingItemId, mitreisenderId, gepackt } = body

    if (!packingItemId || !mitreisenderId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Update the gepackt status for this specific mitreisender
    const result = await db.prepare(`
      UPDATE packlisten_eintrag_mitreisende
      SET gepackt = ?
      WHERE packlisten_eintrag_id = ? AND mitreisender_id = ?
    `).bind(gepackt ? 1 : 0, packingItemId, mitreisenderId).run()

    if (!result.success) {
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
