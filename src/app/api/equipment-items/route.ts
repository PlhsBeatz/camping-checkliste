import { NextResponse } from 'next/server'
import { getDB, getEquipmentItems } from '@/lib/db'

export const runtime = 'edge'

export async function GET() {
  try {
    const env = process.env as any
    const db = getDB(env)
    const equipmentItems = await getEquipmentItems(db)
    return NextResponse.json({ success: true, data: equipmentItems })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
