import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEquipmentItems, CloudflareEnv } from '@/lib/db'

export async function GET() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const items = await getEquipmentItems(db)
    return NextResponse.json({ success: true, data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const env = process.env as unknown as CloudflareEnv
    const _db = getDB(env)
    const _body = (await request.json()) as Record<string, unknown>

    // Note: createEquipmentItem is not yet implemented in db.ts
    // This is a placeholder for future implementation
    console.log('Create equipment item requested:', _body)

    return NextResponse.json({ error: 'Not implemented' }, { status: 501 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
