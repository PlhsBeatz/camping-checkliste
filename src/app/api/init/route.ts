import { NextResponse } from 'next/server'
import { getDB, initializeDatabase, CloudflareEnv } from '@/lib/db'

export const runtime = 'edge'

export async function POST() {
  try {
    const env = process.env as unknown as CloudflareEnv
    const db = getDB(env)
    await initializeDatabase(db)
    return NextResponse.json({ success: true, message: 'Database initialization check completed.' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Initialization error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
