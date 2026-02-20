import { NextRequest, NextResponse } from 'next/server'
import { getDB, getPackStatus, CloudflareEnv } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vacationId = searchParams.get('vacationId')

    if (!vacationId) {
      return NextResponse.json({ error: 'vacationId is required' }, { status: 400 })
    }

    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    const data = await getPackStatus(db, vacationId)

    if (!data) {
      return NextResponse.json({ error: 'Pack-Status nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
