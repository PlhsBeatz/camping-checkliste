import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/db'

/**
 * Initialisierungs-Endpoint für die Datenbank
 * Dieser Endpoint wird beim ersten Laden der App aufgerufen
 */
export async function POST(request: NextRequest) {
  try {
    const env = process.env as any
    const db = env.DB

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    await initializeDatabase(db)

    return NextResponse.json({ success: true, message: 'Database initialized' })
  } catch (error) {
    console.error('Initialization error:', error)
    return NextResponse.json({ error: 'Failed to initialize database' }, { status: 500 })
  }
}
